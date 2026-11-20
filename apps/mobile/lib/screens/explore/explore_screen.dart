import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/app_colors.dart';
import '../../providers/listings_provider.dart';
import '../../providers/location_provider.dart';
import '../../widgets/ambient_background.dart';
import '../../widgets/glass_container.dart';
import '../../widgets/listing_card.dart';
import '../../widgets/location_picker_sheet.dart';

class ExploreScreen extends ConsumerStatefulWidget {
  const ExploreScreen({super.key});

  @override
  ConsumerState<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends ConsumerState<ExploreScreen> {
  final _searchController = TextEditingController();
  String _selectedCategory = 'All';
  String _selectedSort = 'recent';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _triggerSearch();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _triggerSearch() {
    final loc = ref.read(locationProvider).selectedCity;
    ref.read(listingsProvider.notifier).searchListings(
          q: _searchController.text.trim(),
          category: _selectedCategory,
          sort: _selectedSort,
          location: loc,
        );
  }

  @override
  Widget build(BuildContext context) {
    final listingsState = ref.watch(listingsProvider);
    final locationState = ref.watch(locationProvider);

    ref.listen<LocationState>(locationProvider, (previous, next) {
      if (previous?.selectedCity != next.selectedCity) {
        _triggerSearch();
      }
    });

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(60),
        child: ClipRRect(
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
            child: Container(
              padding: EdgeInsets.only(
                top: MediaQuery.of(context).padding.top + 6,
                bottom: 8,
                left: 16,
                right: 16,
              ),
              decoration: const BoxDecoration(
                color: Color(0xB3060B18),
                border: Border(bottom: BorderSide(color: Color(0x2B38BDF8), width: 1)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      const Text(
                        'Discover',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                          color: AppColors.textPrimary,
                          letterSpacing: -0.3,
                        ),
                      ),
                      const SizedBox(width: 10),
                      GestureDetector(
                        onTap: () => showLocationPickerSheet(context),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: const Color(0x381E3A8A),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0x3838BDF8)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.location_on_rounded, size: 12, color: AppColors.accent),
                              const SizedBox(width: 4),
                              ConstrainedBox(
                                constraints: const BoxConstraints(maxWidth: 100),
                                child: Text(
                                  locationState.selectedCity,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.accent,
                                  ),
                                ),
                              ),
                              const Icon(Icons.arrow_drop_down_rounded, size: 14, color: AppColors.accent),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                  PopupMenuButton<String>(
                    icon: const Icon(Icons.tune_rounded, color: AppColors.accent, size: 20),
                    color: const Color(0xFF0F1E3D),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                      side: const BorderSide(color: Color(0x3838BDF8)),
                    ),
                    onSelected: (val) {
                      setState(() => _selectedSort = val);
                      _triggerSearch();
                    },
                    itemBuilder: (context) => [
                      const PopupMenuItem(value: 'recent', child: Text('Recently Added', style: TextStyle(color: AppColors.textPrimary))),
                      const PopupMenuItem(value: 'price_asc', child: Text('Price: Low to High', style: TextStyle(color: AppColors.textPrimary))),
                      const PopupMenuItem(value: 'price_desc', child: Text('Price: High to Low', style: TextStyle(color: AppColors.textPrimary))),
                      const PopupMenuItem(value: 'views', child: Text('Most Popular', style: TextStyle(color: AppColors.textPrimary))),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
      body: AmbientBackground(
        child: Column(
          children: [
            SizedBox(height: MediaQuery.of(context).padding.top + 68),

            // Glass Search Bar
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: GlassContainer(
                level: GlassLevel.standard,
                borderRadius: BorderRadius.circular(20),
                padding: const EdgeInsets.symmetric(horizontal: 14),
                child: TextField(
                  controller: _searchController,
                  onSubmitted: (_) => _triggerSearch(),
                  style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
                  decoration: InputDecoration(
                    icon: const Icon(Icons.search_rounded, size: 20, color: AppColors.accent),
                    hintText: 'Search items, brands, camera gear, tech...',
                    hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 13),
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    fillColor: Colors.transparent,
                    filled: false,
                    contentPadding: const EdgeInsets.symmetric(vertical: 12),
                    suffixIcon: IconButton(
                      icon: const Icon(Icons.arrow_forward_rounded, size: 18, color: AppColors.accent),
                      onPressed: _triggerSearch,
                    ),
                  ),
                ),
              ),
            ),

            // Horizontal Categories Filter Rail
            SizedBox(
              height: 40,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                children: [
                  GestureDetector(
                    onTap: () {
                      setState(() => _selectedCategory = 'All');
                      _triggerSearch();
                    },
                    child: Container(
                      margin: const EdgeInsets.only(right: 8),
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      decoration: BoxDecoration(
                        gradient: _selectedCategory == 'All'
                            ? const LinearGradient(colors: [Color(0xFF2563EB), Color(0xFF06B6D4)])
                            : null,
                        color: _selectedCategory == 'All' ? null : const Color(0x380F1E3D),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: _selectedCategory == 'All'
                              ? Colors.transparent
                              : const Color(0x3338BDF8),
                        ),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        'All',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: _selectedCategory == 'All' ? Colors.white : AppColors.textPrimary,
                        ),
                      ),
                    ),
                  ),
                  ...listingsState.categories.map((c) {
                    final isSel = _selectedCategory == c.name;
                    return GestureDetector(
                      onTap: () {
                        setState(() => _selectedCategory = c.name);
                        _triggerSearch();
                      },
                      child: Container(
                        margin: const EdgeInsets.only(right: 8),
                        padding: const EdgeInsets.symmetric(horizontal: 14),
                        decoration: BoxDecoration(
                          gradient: isSel
                              ? const LinearGradient(colors: [Color(0xFF2563EB), Color(0xFF06B6D4)])
                              : null,
                          color: isSel ? null : const Color(0x380F1E3D),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: isSel ? Colors.transparent : const Color(0x3338BDF8),
                          ),
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          c.name,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: isSel ? Colors.white : AppColors.textPrimary,
                          ),
                        ),
                      ),
                    );
                  }),
                ],
              ),
            ),

            const SizedBox(height: 10),

            // Grid of Listings
            Expanded(
              child: listingsState.isLoading
                  ? const Center(child: CircularProgressIndicator(color: AppColors.accent))
                  : listingsState.searchListings.isEmpty
                      ? Center(
                          child: GlassContainer(
                            level: GlassLevel.standard,
                            padding: const EdgeInsets.all(24),
                            margin: const EdgeInsets.symmetric(horizontal: 24),
                            borderRadius: BorderRadius.circular(20),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: const [
                                Icon(Icons.search_off_rounded, size: 44, color: AppColors.accent),
                                SizedBox(height: 12),
                                Text(
                                  'No listings found',
                                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: AppColors.textPrimary),
                                ),
                                SizedBox(height: 4),
                                Text(
                                  'Try adjusting your keywords or category filters.',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                                ),
                              ],
                            ),
                          ),
                        )
                      : GridView.builder(
                          padding: const EdgeInsets.fromLTRB(16, 4, 16, 96), // Clear bottom nav
                          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 2,
                            crossAxisSpacing: 12,
                            mainAxisSpacing: 12,
                            childAspectRatio: 0.65,
                          ),
                          itemCount: listingsState.searchListings.length,
                          itemBuilder: (context, index) {
                            final item = listingsState.searchListings[index];
                            return MobileListingCard(listing: item);
                          },
                        ),
            ),
          ],
        ),
      ),
    );
  }
}
