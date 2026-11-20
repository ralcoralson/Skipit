import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/app_colors.dart';
import '../../providers/auth_provider.dart';
import '../../providers/listings_provider.dart';
import '../../providers/location_provider.dart';
import '../../widgets/ambient_background.dart';
import '../../widgets/glass_container.dart';
import '../../widgets/listing_card.dart';
import '../../widgets/location_picker_sheet.dart';
import '../../widgets/skipit_brand_mark.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  IconData _getCategoryIcon(String name) {
    final lower = name.toLowerCase();
    if (lower.contains('camera') || lower.contains('photo')) return Icons.camera_alt_rounded;
    if (lower.contains('electronic')) return Icons.laptop_mac_rounded;
    if (lower.contains('game') || lower.contains('console')) return Icons.sports_esports_rounded;
    if (lower.contains('outdoor') || lower.contains('camp')) return Icons.terrain_rounded;
    if (lower.contains('party') || lower.contains('event')) return Icons.celebration_rounded;
    if (lower.contains('tool')) return Icons.construction_rounded;
    if (lower.contains('vehicle') || lower.contains('transport')) return Icons.directions_car_rounded;
    if (lower.contains('fashion')) return Icons.checkroom_rounded;
    return Icons.category_rounded;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final listingsState = ref.watch(listingsProvider);
    final authState = ref.watch(authProvider);
    final locationState = ref.watch(locationProvider);

    ref.listen<LocationState>(locationProvider, (previous, next) {
      if (previous?.selectedCity != next.selectedCity) {
        ref.read(listingsProvider.notifier).fetchInitialData(location: next.selectedCity);
      }
    });

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(68),
        child: ClipRRect(
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
            child: Container(
              padding: EdgeInsets.only(
                top: MediaQuery.of(context).padding.top + 6,
                bottom: 10,
                left: 16,
                right: 16,
              ),
              decoration: const BoxDecoration(
                color: Color(0xB3060B18), // Cosmic space glass
                border: Border(
                  bottom: BorderSide(
                    color: Color(0x2B38BDF8),
                    width: 1,
                  ),
                ),
              ),
              child: Row(
                children: [
                  // Official SkipIt Brand Mark
                  const SkipItBrandMark(
                    size: 38,
                    backgroundColor: AppColors.primary,
                    markColor: Colors.white,
                  ),
                  const SizedBox(width: 12),

                  // Location Selector
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          'skipit',
                          style: GoogleFonts.outfit(
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                            color: AppColors.textPrimary,
                            letterSpacing: -0.5,
                            height: 1.1,
                          ),
                        ),
                        GestureDetector(
                          onTap: () => showLocationPickerSheet(context),
                          behavior: HitTestBehavior.opaque,
                          child: Row(
                            children: [
                              const Icon(Icons.location_on_rounded, size: 12, color: AppColors.accent),
                              const SizedBox(width: 3),
                              ConstrainedBox(
                                constraints: const BoxConstraints(maxWidth: 130),
                                child: Text(
                                  locationState.formattedLocation,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: AppColors.textSecondary,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 2),
                              const Icon(Icons.keyboard_arrow_down_rounded, size: 14, color: AppColors.accent),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  // User Auth / Profile Button
                  if (!authState.isAuthenticated)
                    GestureDetector(
                      onTap: () => context.push('/auth'),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [Color(0xFF2563EB), Color(0xFF0284C7)],
                          ),
                          borderRadius: BorderRadius.circular(20),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFF2563EB).withOpacity(0.4),
                              blurRadius: 10,
                              offset: const Offset(0, 2),
                            ),
                          ],
                          border: Border.all(
                            color: const Color(0x6638BDF8),
                            width: 1,
                          ),
                        ),
                        child: Row(
                          children: const [
                            Icon(Icons.login_rounded, size: 13, color: Colors.white),
                            SizedBox(width: 4),
                            Text(
                              'Sign In',
                              style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w800,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                    )
                  else
                    GestureDetector(
                      onTap: () => context.push('/profile'),
                      child: Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          color: const Color(0xFF0F1E3D),
                          shape: BoxShape.circle,
                          border: Border.all(color: AppColors.accent, width: 1.5),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.accent.withOpacity(0.3),
                              blurRadius: 8,
                            ),
                          ],
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          authState.user?.fullName.characters.first ?? 'U',
                          style: const TextStyle(
                            fontWeight: FontWeight.w900,
                            color: AppColors.accent,
                            fontSize: 15,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
      body: AmbientBackground(
        child: RefreshIndicator(
          color: AppColors.accent,
          backgroundColor: const Color(0xFF0F1E3D),
          onRefresh: () => ref.read(listingsProvider.notifier).fetchInitialData(),
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.only(
              top: MediaQuery.of(context).padding.top + 76,
              bottom: 100, // Clear floating bottom nav
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Glowing Blue Galaxy Search Bar
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: GestureDetector(
                    onTap: () => context.go('/explore'),
                    child: GlassContainer(
                      level: GlassLevel.standard,
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
                      borderRadius: BorderRadius.circular(22),
                      child: Row(
                        children: const [
                          Icon(Icons.search_rounded, size: 22, color: AppColors.accent),
                          SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              'Search cameras, drones, laptops, consoles...',
                              style: TextStyle(
                                color: AppColors.textMuted,
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                          Icon(Icons.tune_rounded, size: 18, color: AppColors.accent),
                        ],
                      ),
                    ),
                  ),
                ),

                const SizedBox(height: 16),

                if (listingsState.error != null && listingsState.categories.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                    child: GlassContainer(
                      level: GlassLevel.premium,
                      padding: const EdgeInsets.all(16),
                      borderRadius: BorderRadius.circular(18),
                      child: Row(
                        children: [
                          const Icon(Icons.sync_problem_rounded, color: AppColors.accent, size: 24),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: const [
                                Text(
                                  'Connection Reconnecting',
                                  style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.textPrimary, fontSize: 13),
                                ),
                                SizedBox(height: 2),
                                Text(
                                  'Pull down or tap retry to reconnect.',
                                  style: TextStyle(color: AppColors.textSecondary, fontSize: 11),
                                ),
                              ],
                            ),
                          ),
                          ElevatedButton(
                            onPressed: () => ref.read(listingsProvider.notifier).fetchInitialData(),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.accent,
                              foregroundColor: AppColors.primary,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                            ),
                            child: const Text('Retry', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
                          ),
                        ],
                      ),
                    ),
                  ),

                // 0% Platform Commission Banner (Blue Galaxy Cosmic Card)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(24),
                    child: BackdropFilter(
                      filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
                      child: Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [
                              Color(0xFF160078), // Official SkipIt Navy
                              Color(0xFF0044FF), // Official SkipIt Electric Blue
                            ],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(24),
                          border: Border.all(
                            color: const Color(0x4D38BDF8),
                            width: 1.2,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFF00C6FF).withOpacity(0.18),
                              blurRadius: 24,
                              offset: const Offset(0, 6),
                            ),
                            BoxShadow(
                              color: Colors.black.withOpacity(0.4),
                              blurRadius: 16,
                              offset: const Offset(0, 8),
                            ),
                          ],
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: const Color(0x3300C6FF),
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(
                                        color: const Color(0x6638BDF8),
                                        width: 1,
                                      ),
                                    ),
                                    child: const Text(
                                      '0% PLATFORM COMMISSION',
                                      style: TextStyle(
                                        color: AppColors.accent,
                                        fontSize: 9,
                                        fontWeight: FontWeight.w900,
                                        letterSpacing: 0.8,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 10),
                                  const Text(
                                    'Skip Buying. Rent Smarter.',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 17,
                                      fontWeight: FontWeight.w900,
                                      letterSpacing: -0.2,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    'Direct peer-to-peer equipment rentals. No middleman cuts, free forever.',
                                    style: TextStyle(
                                      color: Colors.white.withOpacity(0.82),
                                      fontSize: 11,
                                      height: 1.35,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 14),
                            const SkipItBrandMark(
                              size: 50,
                              backgroundColor: Color(0x33FFFFFF),
                              markColor: Colors.white,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),

                const SizedBox(height: 24),

                // Blue Galaxy Categories Capsules
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Categories',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      GestureDetector(
                        onTap: () => context.go('/explore'),
                        child: const Text(
                          'View All',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            color: AppColors.accent,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  height: 46,
                  child: ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    scrollDirection: Axis.horizontal,
                    itemCount: listingsState.categories.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 10),
                    itemBuilder: (context, index) {
                      final cat = listingsState.categories[index];
                      final catIcon = _getCategoryIcon(cat.name);

                      return GlassContainer(
                        level: GlassLevel.subtle,
                        borderRadius: BorderRadius.circular(16),
                        padding: const EdgeInsets.symmetric(horizontal: 14),
                        onTap: () {
                          ref.read(listingsProvider.notifier).searchListings(category: cat.name);
                          context.go('/explore');
                        },
                        child: Row(
                          children: [
                            Icon(
                              catIcon,
                              size: 16,
                              color: AppColors.accent,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              cat.name,
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: AppColors.textPrimary,
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),

                const SizedBox(height: 26),

                // Featured Equipment Carousel
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: const [
                          Icon(Icons.bolt_rounded, size: 20, color: Color(0xFF00C6FF)),
                          SizedBox(width: 6),
                          Text(
                            'Featured Rental Gear',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w900,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ],
                      ),
                      GestureDetector(
                        onTap: () => context.go('/explore'),
                        child: const Text(
                          'See All',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            color: AppColors.accent,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),

                if (listingsState.featuredListings.isEmpty && listingsState.isLoading)
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 16, vertical: 24),
                    child: Center(child: CircularProgressIndicator(color: AppColors.accent)),
                  )
                else
                  SizedBox(
                    height: 275,
                    child: ListView.separated(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      scrollDirection: Axis.horizontal,
                      itemCount: listingsState.featuredListings.length,
                      separatorBuilder: (_, __) => const SizedBox(width: 14),
                      itemBuilder: (context, index) {
                        final item = listingsState.featuredListings[index];
                        return SizedBox(
                          width: 230,
                          child: MobileListingCard(listing: item),
                        );
                      },
                    ),
                  ),

                const SizedBox(height: 26),

                // Recently Added Section
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Row(
                    children: const [
                      Icon(Icons.explore_rounded, size: 18, color: AppColors.accent),
                      SizedBox(width: 6),
                      Text(
                        'Recently Listed Nearby',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),

                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: ListView.separated(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: listingsState.searchListings.take(6).length,
                    separatorBuilder: (_, __) => const SizedBox(height: 14),
                    itemBuilder: (context, index) {
                      final item = listingsState.searchListings[index];
                      return MobileListingCard(listing: item);
                    },
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
