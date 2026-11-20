const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { supabaseAdmin } = require('../../config/supabase');
const config = require('../../config/env');
const { uploadToSupabaseStorage } = require('../../middleware/upload');
const { generateAndStoreOtp, verifyStoredOtp } = require('./otp.service');
const { normalizePhone } = require('../../utils/filterSanitizer');

const googleOAuthClient = new OAuth2Client();

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email || '',
      phone: user.phone || user.phone_number || '',
      role: user.role || 'user',
    },
    config.jwtSecret,
    { expiresIn: '30d' }
  );
};

// 0. Google Authentication (Cryptographic verification via Google OAuth2 ID Token)
const googleAuth = async (req, res, next) => {
  try {
    const { credential, id_token } = req.body;
    const token = credential || id_token;

    // Strict validation: Reject plain email/name input entirely (Phase 1.1)
    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Google ID token (credential or id_token) is required',
      });
    }

    // Verify cryptographic signature with Google Auth Library
    let payload = null;
    try {
      const ticket = await googleOAuthClient.verifyIdToken({
        idToken: token,
        audience: config.googleClientIds.length > 0 ? config.googleClientIds : undefined,
      });
      payload = ticket.getPayload();
    } catch (verifyErr) {
      return res.status(401).json({
        success: false,
        error: `Invalid Google ID token: ${verifyErr.message}`,
      });
    }

    if (!payload || !payload.email) {
      return res.status(401).json({
        success: false,
        error: 'Google ID token payload does not contain a valid email address',
      });
    }

    // Require verified email address from Google
    if (!payload.email_verified) {
      return res.status(403).json({
        success: false,
        error: 'Google account email is not verified',
      });
    }

    const cleanEmail = payload.email.toLowerCase().trim();
    const fullName = payload.name || payload.given_name || cleanEmail.split('@')[0];
    const avatarUrl = payload.picture || null;

    // Direct lookup by email without loading the full user list into memory
    let userId = null;
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, avatar_url, role, is_banned')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (existingProfile) {
      userId = existingProfile.id;
    } else {
      // Provision in Supabase Auth if no profile exists
      const randomPassword = `SkipIt_Google_${Math.random().toString(36).substring(2, 12)}!`;
      const { data: newAuthUser, error: createAuthErr } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password: randomPassword,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          avatar_url: avatarUrl,
          email_verified: true,
          provider: 'google',
        },
      });

      if (createAuthErr) {
        // If user already existed in auth, query by email
        const { data: fallbackProfile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('email', cleanEmail)
          .maybeSingle();
        userId = fallbackProfile?.id || null;
      } else {
        userId = newAuthUser?.user?.id;
      }
    }

    if (!userId) {
      return res.status(500).json({ success: false, error: 'Could not provision Google user account' });
    }

    // Retrieve or create profile entry with kyc_status 'unverified' (NOT 'none')
    let { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (!profile) {
      const { data: newProfile, error: pErr } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: userId,
          email: cleanEmail,
          full_name: fullName,
          avatar_url: avatarUrl,
          location: 'Bengaluru, India',
          role: 'user',
          rating: 5.0,
          trust_score: 75,
          is_verified: true,
          kyc_status: 'unverified', // Valid per DB check constraint
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (pErr) {
        console.error('[Google Auth Profile Upsert Error]:', pErr);
      }
      profile = newProfile;
    } else {
      const updates = {};
      if (!profile.avatar_url && avatarUrl) updates.avatar_url = avatarUrl;
      if (!profile.email) updates.email = cleanEmail;
      if ((!profile.full_name || profile.full_name === 'SkipIt Member') && fullName) updates.full_name = fullName;
      if (!profile.is_verified) updates.is_verified = true;
      if (Object.keys(updates).length > 0) {
        updates.updated_at = new Date().toISOString();
        const { data: updatedProfile } = await supabaseAdmin
          .from('profiles')
          .update(updates)
          .eq('id', userId)
          .select()
          .single();
        if (updatedProfile) profile = updatedProfile;
      }
    }

    if (profile?.is_banned) {
      return res.status(403).json({
        success: false,
        error: 'Your account has been suspended by administration',
      });
    }

    const tokenPayload = {
      id: userId,
      email: cleanEmail,
      role: profile?.role || 'user',
    };
    const authToken = generateToken(tokenPayload);

    console.log(`[Google Auth Success]: Authenticated ${cleanEmail} (ID: ${userId})`);

    res.json({
      success: true,
      message: 'Signed in with Google successfully',
      token: authToken,
      user: {
        ...(profile || {}),
        id: userId,
        email: cleanEmail,
        full_name: profile?.full_name || fullName || cleanEmail.split('@')[0],
      },
    });
  } catch (error) {
    console.error('[Google Auth Unhandled Error]:', error);
    next(error);
  }
};

// 1. Mobile or Email Registration
const register = async (req, res, next) => {
  try {
    const { email, password, phone, full_name, location } = req.body;

    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        error: 'Either email or phone number is required',
      });
    }

    const userEmail = email || `${phone.replace(/\D/g, '')}@skipit.local`;
    const userPassword = password || `SkipIt_${Math.random().toString(36).substring(2, 10)}`;

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: userEmail,
      password: userPassword,
      email_confirm: true,
      user_metadata: { full_name, phone },
    });

    if (authError) {
      // If user already exists, find existing profile
      if (authError.message.includes('already registered') || authError.code === 'user_already_exists') {
        return res.status(409).json({
          success: false,
          error: 'An account with this email or phone already exists',
        });
      }
      return res.status(400).json({ success: false, error: authError.message });
    }

    const userId = authData.user.id;

    // Create profile entry
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        full_name: full_name || 'SkipIt Member',
        email: userEmail,
        phone: phone || '',
        phone_number: phone || '',
        location: location || 'Bengaluru, India',
        role: 'user',
        rating: 5.0,
        trust_score: 50,
        is_verified: false,
        kyc_status: 'unverified',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (profileError) {
      console.error('[Register Profile Error]:', profileError);
    }

    const token = generateToken({ id: userId, email: userEmail, phone, role: 'user' });

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token,
      user: profile || { id: userId, full_name, email: userEmail, phone },
    });
  } catch (error) {
    next(error);
  }
};

// 2. Login with Password or Mobile (Phase 1.2: Normalized phone & parameterized queries)
const login = async (req, res, next) => {
  try {
    const { email, phone, password } = req.body;

    let targetEmail = email;

    if (!targetEmail && phone) {
      const cleanPhone = normalizePhone(phone);
      // Find user by phone without PostgREST .or() filter injection
      let { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('phone', cleanPhone)
        .maybeSingle();

      if (!profile) {
        const { data: profileByNum } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .eq('phone_number', cleanPhone)
          .maybeSingle();
        profile = profileByNum;
      }

      if (profile) {
        targetEmail = profile.email || `${cleanPhone.replace(/\D/g, '')}@skipit.local`;
      } else {
        targetEmail = `${cleanPhone.replace(/\D/g, '')}@skipit.local`;
      }
    }

    if (!targetEmail) {
      return res.status(400).json({
        success: false,
        error: 'Please provide email or phone number to sign in',
      });
    }

    // Try Supabase auth sign-in
    let { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email: targetEmail,
      password,
    });

    if (authError || !authData.user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials. Please verify your email/phone and password.',
      });
    }

    const userId = authData.user.id;

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profile && profile.is_banned) {
      return res.status(403).json({
        success: false,
        error: 'Your account has been suspended by administration',
      });
    }

    const token = generateToken(profile || { id: userId, email: targetEmail });

    res.json({
      success: true,
      message: 'Logged in successfully',
      token,
      user: profile || { id: userId, email: targetEmail },
    });
  } catch (error) {
    next(error);
  }
};

// 3. Send Mobile OTP (Multi-Provider SMS + Dedicated Table Storage)
const sendOtp = async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }

    const cleanPhone = normalizePhone(phone);
    const { expiresInSeconds, devOtp } = await generateAndStoreOtp(cleanPhone);

    res.json({
      success: true,
      message: `Verification code sent to ${cleanPhone}`,
      expires_in: expiresInSeconds,
      ...(devOtp ? { devOtp, devNote: `Development code: ${devOtp}` } : {}),
    });
  } catch (error) {
    next(error);
  }
};

// 4. Verify OTP with Attempt Throttling & Replay Defense (No .or() filter injection)
const verifyOtp = async (req, res, next) => {
  try {
    const { phone, otp, full_name } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ success: false, error: 'Phone number and verification code are required' });
    }

    const cleanPhone = normalizePhone(phone);
    const verificationResult = await verifyStoredOtp(cleanPhone, otp.trim());

    if (!verificationResult.valid) {
      return res.status(400).json({
        success: false,
        error: verificationResult.error || 'Invalid or expired verification code',
      });
    }

    // Check if user exists with this phone without .or() strings
    let { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('phone', cleanPhone)
      .maybeSingle();

    if (!profile) {
      const { data: profileByNum } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('phone_number', cleanPhone)
        .maybeSingle();
      profile = profileByNum;
    }

    let userId = profile ? profile.id : null;

    if (!profile) {
      // Auto-provision user account
      const digitsOnly = cleanPhone.replace(/\D/g, '');
      const syntheticEmail = `${digitsOnly}@skipit.local`;
      const randomPassword = `SkipIt_${Math.random().toString(36).substring(2, 12)}!`;

      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: syntheticEmail,
        password: randomPassword,
        phone: cleanPhone,
        email_confirm: true,
        phone_confirm: true,
        user_metadata: {
          full_name: full_name || `SkipIt Member ${digitsOnly.slice(-4)}`,
        },
      });

      if (createErr) {
        // Fallback if auth already created
        const { data: fallbackUser } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('phone', cleanPhone)
          .maybeSingle();
        userId = fallbackUser?.id || null;
      } else {
        userId = newUser?.user?.id;
      }

      if (!userId) {
        return res.status(500).json({ success: false, error: 'Failed to provision user profile' });
      }

      // Create new profile with kyc_status 'unverified'
      const { data: createdProfile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: userId,
          full_name: full_name || `SkipIt Member ${digitsOnly.slice(-4)}`,
          email: syntheticEmail,
          phone: cleanPhone,
          phone_number: cleanPhone,
          location: 'Bengaluru, India',
          role: 'user',
          rating: 5.0,
          trust_score: 50,
          is_verified: false,
          kyc_status: 'unverified',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      profile = createdProfile;
    }

    if (profile?.is_banned) {
      return res.status(403).json({
        success: false,
        error: 'Your account has been suspended by administration',
      });
    }

    const token = generateToken(profile || { id: userId, phone: cleanPhone });

    res.json({
      success: true,
      message: 'Phone verified successfully',
      token,
      user: profile,
    });
  } catch (error) {
    next(error);
  }
};

// 5. Get current profile
const getMe = async (req, res, next) => {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error || !profile) {
      return res.status(404).json({ success: false, error: 'User profile not found' });
    }

    res.json({
      success: true,
      user: profile,
    });
  } catch (error) {
    next(error);
  }
};

// 6. Update Profile
const updateProfile = async (req, res, next) => {
  try {
    const { full_name, bio, location, phone, phone_number } = req.body;

    const updates = {
      updated_at: new Date().toISOString(),
    };
    if (full_name !== undefined) updates.full_name = full_name;
    if (bio !== undefined) updates.bio = bio;
    if (location !== undefined) updates.location = location;
    if (phone !== undefined) {
      updates.phone = phone;
      updates.phone_number = phone;
    }

    const { data: updatedProfile, error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedProfile,
    });
  } catch (error) {
    next(error);
  }
};

// 7. Upload Avatar
const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file uploaded' });
    }

    const publicUrl = await uploadToSupabaseStorage(req.file, 'avatars', req.user.id);

    const { data: updatedProfile, error } = await supabaseAdmin
      .from('profiles')
      .update({
        avatar_url: publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      message: 'Avatar uploaded successfully',
      avatar_url: publicUrl,
      user: updatedProfile,
    });
  } catch (error) {
    next(error);
  }
};

// 8. Submit KYC verification documents
const submitKyc = async (req, res, next) => {
  try {
    const { document_type } = req.body;
    let documentUrl = null;
    let selfieUrl = null;

    if (req.files && req.files.document && req.files.document[0]) {
      documentUrl = await uploadToSupabaseStorage(req.files.document[0], 'kyc-documents', `${req.user.id}/doc`);
    }

    if (req.files && req.files.selfie && req.files.selfie[0]) {
      selfieUrl = await uploadToSupabaseStorage(req.files.selfie[0], 'kyc-documents', `${req.user.id}/selfie`);
    }

    const { data: updatedProfile, error } = await supabaseAdmin
      .from('profiles')
      .update({
        kyc_status: 'pending',
        kyc_document_type: document_type || 'Aadhaar / National ID',
        kyc_document_url: documentUrl,
        kyc_selfie_url: selfieUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      message: 'Verification documents submitted. Our team will review them within 24 hours.',
      user: updatedProfile,
    });
  } catch (error) {
    next(error);
  }
};

// 9. Delete Account (Phase 3.4 & Phase 1: Storage cleanup and safe idempotent execution)
const deleteAccount = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Fetch profile to find storage objects
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('avatar_url, kyc_document_url, kyc_selfie_url')
      .eq('id', userId)
      .maybeSingle();

    // Clean up avatar from storage
    if (profile?.avatar_url) {
      const avatarPath = profile.avatar_url.includes('/avatars/')
        ? profile.avatar_url.split('/avatars/')[1].split('?')[0]
        : profile.avatar_url;
      try {
        await supabaseAdmin.storage.from('avatars').remove([avatarPath]);
      } catch (err) {
        console.warn('[Storage Cleanup Avatar Warning]:', err.message);
      }
    }

    // Clean up KYC documents from storage
    const kycFilesToRemove = [];
    if (profile?.kyc_document_url) {
      const docPath = profile.kyc_document_url.includes('/kyc-documents/')
        ? profile.kyc_document_url.split('/kyc-documents/')[1].split('?')[0]
        : profile.kyc_document_url;
      kycFilesToRemove.push(docPath);
    }
    if (profile?.kyc_selfie_url) {
      const selfiePath = profile.kyc_selfie_url.includes('/kyc-documents/')
        ? profile.kyc_selfie_url.split('/kyc-documents/')[1].split('?')[0]
        : profile.kyc_selfie_url;
      kycFilesToRemove.push(selfiePath);
    }
    if (kycFilesToRemove.length > 0) {
      try {
        await supabaseAdmin.storage.from('kyc-documents').remove(kycFilesToRemove);
      } catch (err) {
        console.warn('[Storage Cleanup KYC Warning]:', err.message);
      }
    }

    // Deactivate user's listings
    await supabaseAdmin
      .from('listings')
      .update({ is_active: false, is_available: false })
      .eq('owner_id', userId);

    // Anonymize and soft-ban profile (idempotent: safe to run repeatedly)
    await supabaseAdmin
      .from('profiles')
      .update({
        is_banned: true,
        full_name: 'Deleted User',
        bio: 'Account closed',
        avatar_url: null,
        kyc_document_url: null,
        kyc_selfie_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    res.json({
      success: true,
      message: 'Account and associated personal storage data deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  googleAuth,
  register,
  login,
  sendOtp,
  verifyOtp,
  getMe,
  updateProfile,
  uploadAvatar,
  submitKyc,
  deleteAccount,
};
