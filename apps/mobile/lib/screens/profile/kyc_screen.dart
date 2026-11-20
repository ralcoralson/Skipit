import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/ambient_background.dart';
import '../../widgets/glass_container.dart';

class KycScreen extends ConsumerStatefulWidget {
  const KycScreen({super.key});

  @override
  ConsumerState<KycScreen> createState() => _KycScreenState();
}

class _KycScreenState extends ConsumerState<KycScreen> {
  final _picker = ImagePicker();
  XFile? _documentFile;
  XFile? _selfieFile;
  bool _isSubmitting = false;
  String? _kycStatus;

  @override
  void initState() {
    super.initState();
    _fetchKycStatus();
  }

  Future<void> _fetchKycStatus() async {
    try {
      final res = await apiClient.dio.get('/auth/me');
      if (res.data['user'] != null) {
        setState(() {
          _kycStatus = res.data['user']['kyc_status'] ?? 'unverified';
        });
      }
    } catch (_) {
      setState(() {
        _kycStatus = ref.read(authProvider).user?.kycStatus ?? 'unverified';
      });
    }
  }

  Future<void> _pickDocument() async {
    final picked = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (picked != null) {
      setState(() => _documentFile = picked);
    }
  }

  Future<void> _pickSelfie() async {
    final picked = await _picker.pickImage(source: ImageSource.camera, imageQuality: 85);
    if (picked != null) {
      setState(() => _selfieFile = picked);
    }
  }

  Future<void> _submitKyc() async {
    if (_documentFile == null || _selfieFile == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please upload both an ID document and a selfie')),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      final formData = FormData.fromMap({
        'document': await MultipartFile.fromFile(_documentFile!.path, filename: _documentFile!.name),
        'selfie': await MultipartFile.fromFile(_selfieFile!.path, filename: _selfieFile!.name),
      });

      await apiClient.dio.post('/auth/kyc', data: formData);
      setState(() {
        _isSubmitting = false;
        _kycStatus = 'pending';
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: Color(0xFF0F2454),
          content: Text('KYC documents submitted for review!', style: TextStyle(color: AppColors.accent, fontWeight: FontWeight.bold)),
        ),
      );
    } catch (e) {
      setState(() => _isSubmitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(backgroundColor: Colors.redAccent, content: Text('KYC submission failed: $e')),
      );
    }
  }

  Color _getStatusColor() {
    switch (_kycStatus) {
      case 'approved':
        return const Color(0xFF10B981);
      case 'pending':
        return const Color(0xFFF59E0B);
      case 'rejected':
        return const Color(0xFFEF4444);
      default:
        return const Color(0xFF6B7280);
    }
  }

  @override
  Widget build(BuildContext context) {
    final statusColor = _getStatusColor();
    final statusText = (_kycStatus ?? 'unverified').toUpperCase();

    return Scaffold(
      backgroundColor: AppColors.background,
      body: AmbientBackground(
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.arrow_back_ios_new_rounded, color: AppColors.textPrimary, size: 20),
                      onPressed: () => context.pop(),
                    ),
                    const SizedBox(width: 8),
                    const Text(
                      'Identity Verification (KYC)',
                      style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: AppColors.textPrimary),
                    ),
                  ],
                ),
              ),

              Expanded(
                child: ListView(
                  padding: const EdgeInsets.all(20),
                  children: [
                    // Status Banner
                    GlassContainer(
                      level: GlassLevel.standard,
                      borderRadius: BorderRadius.circular(20),
                      padding: const EdgeInsets.all(18),
                      child: Row(
                        children: [
                          Icon(
                            _kycStatus == 'approved' ? Icons.verified_user_rounded : Icons.shield_outlined,
                            size: 32,
                            color: statusColor,
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Verification Status',
                                    style: TextStyle(fontSize: 12, color: AppColors.textMuted)),
                                const SizedBox(height: 2),
                                Text(
                                  statusText,
                                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: statusColor),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 20),

                    // Consent & DPDP Notice
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: const Color(0x220284C7),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0x3338BDF8)),
                      ),
                      child: const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Privacy & Data Protection Notice (DPDP Act)',
                              style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.accent)),
                          SizedBox(height: 6),
                          Text(
                            'Your identity documents are encrypted and securely stored in private cloud buckets. They are solely accessible by verified SkipIt administrators for fraud prevention and trust scoring, and are never shared with other users.',
                            style: TextStyle(fontSize: 11, color: AppColors.textSecondary, height: 1.4),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 24),

                    if (_kycStatus != 'approved') ...[
                      // Upload Document Tile
                      InkWell(
                        onTap: _pickDocument,
                        child: GlassContainer(
                          level: GlassLevel.subtle,
                          borderRadius: BorderRadius.circular(16),
                          padding: const EdgeInsets.all(16),
                          child: Row(
                            children: [
                              Icon(Icons.badge_outlined, color: _documentFile != null ? const Color(0xFF10B981) : AppColors.accent, size: 28),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text('Government ID Document',
                                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
                                    const SizedBox(height: 2),
                                    Text(
                                      _documentFile != null ? _documentFile!.name : 'Upload Aadhaar, Passport, or Driving License',
                                      style: TextStyle(fontSize: 11, color: _documentFile != null ? const Color(0xFF10B981) : AppColors.textMuted),
                                    ),
                                  ],
                                ),
                              ),
                              Icon(_documentFile != null ? Icons.check_circle_rounded : Icons.upload_file_rounded,
                                  color: _documentFile != null ? const Color(0xFF10B981) : AppColors.accent),
                            ],
                          ),
                        ),
                      ),

                      const SizedBox(height: 14),

                      // Upload Selfie Tile
                      InkWell(
                        onTap: _pickSelfie,
                        child: GlassContainer(
                          level: GlassLevel.subtle,
                          borderRadius: BorderRadius.circular(16),
                          padding: const EdgeInsets.all(16),
                          child: Row(
                            children: [
                              Icon(Icons.face_retouching_natural_rounded,
                                  color: _selfieFile != null ? const Color(0xFF10B981) : AppColors.accent, size: 28),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text('Live Verification Selfie',
                                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
                                    const SizedBox(height: 2),
                                    Text(
                                      _selfieFile != null ? _selfieFile!.name : 'Capture a clear photo of your face',
                                      style: TextStyle(fontSize: 11, color: _selfieFile != null ? const Color(0xFF10B981) : AppColors.textMuted),
                                    ),
                                  ],
                                ),
                              ),
                              Icon(_selfieFile != null ? Icons.check_circle_rounded : Icons.camera_alt_outlined,
                                  color: _selfieFile != null ? const Color(0xFF10B981) : AppColors.accent),
                            ],
                          ),
                        ),
                      ),

                      const SizedBox(height: 28),

                      SizedBox(
                        height: 50,
                        child: ElevatedButton(
                          onPressed: _isSubmitting ? null : _submitKyc,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          ),
                          child: _isSubmitting
                              ? const CircularProgressIndicator(color: Colors.white)
                              : const Text('Submit for Verification',
                                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white)),
                        ),
                      ),
                    ] else ...[
                      const Center(
                        child: Padding(
                          padding: EdgeInsets.symmetric(vertical: 40),
                          child: Column(
                            children: [
                              Icon(Icons.check_circle_rounded, size: 64, color: Color(0xFF10B981)),
                              SizedBox(height: 16),
                              Text('Your identity is verified',
                                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
                              SizedBox(height: 6),
                              Text('You have maximum trust score access on SkipIt marketplace.',
                                  style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
