import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_colors.dart';
import '../../providers/auth_provider.dart';
import '../../providers/listings_provider.dart';
import '../../widgets/ambient_background.dart';
import '../../widgets/glass_container.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(listingsProvider.notifier).fetchMyListings();
    });
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final myListings = ref.watch(listingsProvider).myListings;

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(60),
        child: ClipRRect(
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
            child: Container(
              padding: EdgeInsets.only(
                top: MediaQuery.of(context).padding.top + 6,
                bottom: 8,
                left: 16,
                right: 16,
              ),
              decoration: const BoxDecoration(
                color: Color(0xB3060B18),
                border: Border(
                    bottom: BorderSide(color: Color(0x2B38BDF8), width: 1)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'My Account & Gear',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                      color: AppColors.textPrimary,
                      letterSpacing: -0.3,
                    ),
                  ),
                  if (authState.isAuthenticated)
                    IconButton(
                      icon: const Icon(Icons.logout_rounded,
                          color: AppColors.error, size: 20),
                      onPressed: () {
                        ref.read(authProvider.notifier).logout();
                      },
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
      body: AmbientBackground(
        child: !authState.isAuthenticated
            ? Center(
                child: GlassContainer(
                  level: GlassLevel.premium,
                  padding: const EdgeInsets.all(28),
                  margin: const EdgeInsets.symmetric(horizontal: 24),
                  borderRadius: BorderRadius.circular(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 56,
                        height: 56,
                        decoration: const BoxDecoration(
                          color: AppColors.light,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.person_outline_rounded,
                            size: 28, color: AppColors.primary),
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        'Join SkipIt',
                        style: TextStyle(
                            fontWeight: FontWeight.w900,
                            fontSize: 18,
                            color: AppColors.textPrimary),
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'Sign in to list items, negotiate directly with renters, manage verifications, and track your listings.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                            fontSize: 12,
                            color: AppColors.textSecondary,
                            height: 1.4),
                      ),
                      const SizedBox(height: 20),
                      ElevatedButton(
                        onPressed: () => context.push('/auth'),
                        child: const Text('Sign In or Register'),
                      ),
                    ],
                  ),
                ),
              )
            : SingleChildScrollView(
                padding: EdgeInsets.only(
                  top: MediaQuery.of(context).padding.top + 76,
                  bottom: 96, // Clear floating bottom nav
                  left: 16,
                  right: 16,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // User Profile Glass Level 3 Card
                    GlassContainer(
                      level: GlassLevel.premium,
                      padding: const EdgeInsets.all(18),
                      borderRadius: BorderRadius.circular(24),
                      child: Row(
                        children: [
                          Container(
                            width: 58,
                            height: 58,
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [AppColors.primary, AppColors.accent],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                              shape: BoxShape.circle,
                              boxShadow: [
                                BoxShadow(
                                  color: AppColors.primary.withOpacity(0.35),
                                  blurRadius: 10,
                                  offset: const Offset(0, 3),
                                ),
                              ],
                            ),
                            alignment: Alignment.center,
                            child: Text(
                              authState.user!.fullName.characters.first,
                              style: const TextStyle(
                                fontSize: 24,
                                fontWeight: FontWeight.w900,
                                color: Colors.white,
                              ),
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Text(
                                      authState.user!.fullName,
                                      style: const TextStyle(
                                        fontSize: 17,
                                        fontWeight: FontWeight.w900,
                                        color: AppColors.textPrimary,
                                      ),
                                    ),
                                    if (authState.user!.isVerified) ...[
                                      const SizedBox(width: 5),
                                      const Icon(Icons.verified_rounded,
                                          size: 16, color: AppColors.primary),
                                    ],
                                  ],
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  authState.user!.phone ??
                                      authState.user!.email ??
                                      '',
                                  style: const TextStyle(
                                      fontSize: 12,
                                      color: AppColors.textSecondary),
                                ),
                                const SizedBox(height: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: AppColors.light,
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(
                                        color:
                                            AppColors.accent.withOpacity(0.4),
                                        width: 0.8),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      const Icon(Icons.shield_rounded,
                                          size: 12, color: AppColors.primary),
                                      const SizedBox(width: 4),
                                      Text(
                                        'Trust Score: ${authState.user!.trustScore}/100',
                                        style: const TextStyle(
                                          fontSize: 10,
                                          fontWeight: FontWeight.w800,
                                          color: AppColors.primary,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 16),

                    // KYC Identity Status Panel
                    InkWell(
                      onTap: () => context.push('/kyc'),
                      borderRadius: BorderRadius.circular(20),
                      child: GlassContainer(
                        level: GlassLevel.standard,
                        padding: const EdgeInsets.all(16),
                        borderRadius: BorderRadius.circular(20),
                        child: Row(
                          children: [
                            Container(
                              width: 42,
                              height: 42,
                              decoration: BoxDecoration(
                                color: authState.user!.isVerified
                                    ? AppColors.success.withOpacity(0.15)
                                    : AppColors.warning.withOpacity(0.15),
                                shape: BoxShape.circle,
                              ),
                              child: Icon(
                                authState.user!.isVerified
                                    ? Icons.verified_user_rounded
                                    : Icons.gpp_maybe_rounded,
                                color: authState.user!.isVerified
                                    ? AppColors.success
                                    : AppColors.warning,
                                size: 22,
                              ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    authState.user!.isVerified
                                        ? 'Identity Verified'
                                        : 'KYC Verification Pending',
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w800,
                                      color: authState.user!.isVerified
                                          ? AppColors.success
                                          : AppColors.textPrimary,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    authState.user!.isVerified
                                        ? 'Your verified host badge is live to all renters.'
                                        : 'Upload Gov ID to boost trust score and unlock badges.',
                                    style: const TextStyle(
                                        fontSize: 11,
                                        color: AppColors.textSecondary),
                                  ),
                                ],
                              ),
                            ),
                            const Icon(Icons.arrow_forward_ios_rounded,
                                size: 14, color: AppColors.accent),
                          ],
                        ),
                      ),
                    ),

                    const SizedBox(height: 16),

                    // Quick Actions Hub
                    GlassContainer(
                      level: GlassLevel.subtle,
                      padding: const EdgeInsets.all(14),
                      borderRadius: BorderRadius.circular(20),
                      child: Column(
                        children: [
                          _buildMenuTile(
                            icon: Icons.calendar_month_rounded,
                            title: 'My Rentals Hub',
                            subtitle: 'View incoming and sent rental requests',
                            onTap: () => context.push('/rentals'),
                          ),
                          const Divider(color: Color(0x2038BDF8), height: 16),
                          _buildMenuTile(
                            icon: Icons.favorite_rounded,
                            title: 'Saved Wishlist',
                            subtitle: 'Items you bookmarked for later',
                            onTap: () => context.push('/wishlist'),
                          ),
                          const Divider(color: Color(0x2038BDF8), height: 16),
                          _buildMenuTile(
                            icon: Icons.notifications_rounded,
                            title: 'Notifications',
                            subtitle: 'Rental alerts and inquiry updates',
                            onTap: () => context.push('/notifications'),
                          ),
                          const Divider(color: Color(0x2038BDF8), height: 16),
                          _buildMenuTile(
                            icon: Icons.headset_mic_rounded,
                            title: 'Support Tickets',
                            subtitle: 'Get help or report a dispute',
                            onTap: () => context.push('/support'),
                          ),
                          const Divider(color: Color(0x2038BDF8), height: 16),
                          _buildMenuTile(
                            icon: Icons.edit_note_rounded,
                            title: 'Edit Profile & Avatar',
                            subtitle: 'Update your display name and photo',
                            onTap: () => context.push('/edit-profile'),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 24),

                    // My Listings Header
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'My Rental Gear',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        GestureDetector(
                          onTap: () => context.push('/create-listing'),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 6),
                            decoration: BoxDecoration(
                              color: AppColors.primary,
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: Row(
                              children: const [
                                Icon(Icons.add_rounded,
                                    size: 16, color: Colors.white),
                                SizedBox(width: 4),
                                Text(
                                  'Add Gear',
                                  style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 11,
                                      fontWeight: FontWeight.w800),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),

                    if (myListings.isEmpty)
                      GlassContainer(
                        level: GlassLevel.subtle,
                        padding: const EdgeInsets.all(24),
                        borderRadius: BorderRadius.circular(20),
                        child: Center(
                          child: Column(
                            children: const [
                              Icon(Icons.inventory_2_outlined,
                                  size: 36, color: AppColors.primary),
                              SizedBox(height: 8),
                              Text(
                                'No gear listed yet',
                                style: TextStyle(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 14,
                                    color: AppColors.textPrimary),
                              ),
                              SizedBox(height: 4),
                              Text(
                                'List your idle equipment and earn 100% of rental earnings with 0% platform fee.',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                    fontSize: 11,
                                    color: AppColors.textSecondary),
                              ),
                            ],
                          ),
                        ),
                      )
                    else
                      ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: myListings.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (context, index) {
                          final item = myListings[index];
                          return GlassContainer(
                            level: GlassLevel.standard,
                            padding: const EdgeInsets.all(12),
                            borderRadius: BorderRadius.circular(18),
                            child: Row(
                              children: [
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(12),
                                  child: Image.network(
                                    item.images.isNotEmpty
                                        ? item.images.first
                                        : '',
                                    width: 56,
                                    height: 56,
                                    fit: BoxFit.cover,
                                    errorBuilder: (_, __, ___) => Container(
                                      width: 56,
                                      height: 56,
                                      color: AppColors.backgroundSecondary,
                                      child: const Icon(Icons.image_outlined,
                                          color: AppColors.textMuted),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        item.title,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                            fontWeight: FontWeight.w800,
                                            fontSize: 13,
                                            color: AppColors.textPrimary),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        '₹${item.pricePerDay.toInt()}/day',
                                        style: const TextStyle(
                                            color: AppColors.primary,
                                            fontWeight: FontWeight.w900,
                                            fontSize: 12),
                                      ),
                                      Text(
                                        item.isAvailable ? 'Active' : 'Paused',
                                        style: TextStyle(
                                          fontSize: 10,
                                          fontWeight: FontWeight.w700,
                                          color: item.isAvailable
                                              ? AppColors.success
                                              : AppColors.textMuted,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                IconButton(
                                  icon: Icon(
                                    item.isAvailable
                                        ? Icons.pause_circle_outline_rounded
                                        : Icons.play_circle_outline_rounded,
                                    color: AppColors.textSecondary,
                                    size: 22,
                                  ),
                                  onPressed: () => ref
                                      .read(listingsProvider.notifier)
                                      .toggleListingStatus(item.id),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.delete_outline_rounded,
                                      color: AppColors.error, size: 22),
                                  onPressed: () => ref
                                      .read(listingsProvider.notifier)
                                      .deleteListing(item.id),
                                ),
                              ],
                            ),
                          );
                        },
                      ),

                    const SizedBox(height: 32),

                    // Danger Zone: Delete Account
                    Center(
                      child: TextButton.icon(
                        icon: const Icon(Icons.delete_forever_rounded, color: Colors.redAccent, size: 18),
                        label: const Text(
                          'Delete SkipIt Account & Data',
                          style: TextStyle(color: Colors.redAccent, fontSize: 13, fontWeight: FontWeight.w700),
                        ),
                        onPressed: () => _showDeleteAccountDialog(context),
                      ),
                    ),
                    const SizedBox(height: 40),
                  ],
                ),
              ),
      ),
    );
  }

  Widget _buildMenuTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.primary.withOpacity(0.18),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: AppColors.accent, size: 18),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                  ),
                ],
              ),
            ),
            const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: AppColors.textMuted),
          ],
        ),
      ),
    );
  }

  void _showDeleteAccountDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFA0A1128),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: Colors.redAccent),
        ),
        title: const Text('Delete Account?',
            style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold)),
        content: const Text(
          'This action is irreversible. Your profile, listings, and stored identity verification documents will be permanently removed.',
          style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: AppColors.textMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
            onPressed: () async {
              Navigator.pop(ctx);
              await ref.read(authProvider.notifier).deleteAccount();
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Account deleted successfully')),
                );
              }
            },
            child: const Text('Delete Permanently',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }
}
