import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../core/network/api_client.dart';
import '../core/theme/app_colors.dart';
import '../models/listing_model.dart';

class MobileListingCard extends StatefulWidget {
  final ListingModel listing;
  final VoidCallback? onWishlistTap;
  final VoidCallback? onTap;

  const MobileListingCard({
    super.key,
    required this.listing,
    this.onWishlistTap,
    this.onTap,
  });

  @override
  State<MobileListingCard> createState() => _MobileListingCardState();
}

class _MobileListingCardState extends State<MobileListingCard> {
  late bool _isWishlisted;

  @override
  void initState() {
    super.initState();
    _isWishlisted = widget.listing.isWishlisted;
  }

  Future<void> _toggleWishlist() async {
    setState(() => _isWishlisted = !_isWishlisted);
    try {
      if (_isWishlisted) {
        await apiClient.dio.post('/wishlist/${widget.listing.id}');
      } else {
        await apiClient.dio.delete('/wishlist/${widget.listing.id}');
      }
      widget.onWishlistTap?.call();
    } catch (_) {
      // Rollback on failure
      setState(() => _isWishlisted = !_isWishlisted);
    }
  }

  @override
  Widget build(BuildContext context) {
    final listing = widget.listing;
    final primaryImg = listing.images.isNotEmpty
        ? listing.images.first
        : 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=600&q=80';

    return GestureDetector(
      onTap: widget.onTap ??
          () {
            context.push('/listing/${listing.id}', extra: listing);
          },
      child: ClipRRect(
        borderRadius: BorderRadius.circular(22),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
          child: Container(
            decoration: BoxDecoration(
              color: const Color(0x550F1E3D), // Cosmic Sapphire Glass
              borderRadius: BorderRadius.circular(22),
              border: Border.all(
                color: const Color(0x3838BDF8), // Glowing Cyan Border
                width: 1.2,
              ),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF00C6FF).withOpacity(0.08),
                  blurRadius: 18,
                  offset: const Offset(0, 4),
                ),
                BoxShadow(
                  color: Colors.black.withOpacity(0.40),
                  blurRadius: 16,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Product Image Container
                Stack(
                  children: [
                    AspectRatio(
                      aspectRatio: 16 / 10,
                      child: Image.network(
                        primaryImg,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Container(
                          color: const Color(0xFF0B1426),
                          child: const Icon(Icons.broken_image, color: AppColors.textMuted),
                        ),
                      ),
                    ),

                    // Condition Badge (Frosted Galaxy Pill)
                    Positioned(
                      top: 10,
                      left: 10,
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: BackdropFilter(
                          filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: const Color(0xD9060B18),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: const Color(0x4038BDF8),
                                width: 0.8,
                              ),
                            ),
                            child: Text(
                              listing.condition.replaceAll('_', ' ').toUpperCase(),
                              style: const TextStyle(
                                color: AppColors.accent,
                                fontSize: 9,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),

                    // 0% Commission Badge
                    Positioned(
                      top: 10,
                      right: 10,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [Color(0xFF2563EB), Color(0xFF06B6D4)],
                          ),
                          borderRadius: BorderRadius.circular(12),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFF06B6D4).withOpacity(0.4),
                              blurRadius: 6,
                            ),
                          ],
                        ),
                        child: const Text(
                          '0% FEE',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 9,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.4,
                          ),
                        ),
                      ),
                    ),

                    // Heart Bookmark Button
                    Positioned(
                      bottom: 8,
                      right: 8,
                      child: GestureDetector(
                        onTap: _toggleWishlist,
                        child: Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: const Color(0xCC060B18),
                            shape: BoxShape.circle,
                            border: Border.all(color: const Color(0x3538BDF8)),
                          ),
                          child: Icon(
                            _isWishlisted ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                            color: _isWishlisted ? Colors.redAccent : Colors.white,
                            size: 16,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),

                // Card Content Area
                Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Category Tag
                      Text(
                        listing.category.toUpperCase(),
                        style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          color: AppColors.accent,
                          letterSpacing: 0.6,
                        ),
                      ),
                      const SizedBox(height: 4),

                      // Listing Title
                      Text(
                        listing.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                          height: 1.25,
                        ),
                      ),
                      const SizedBox(height: 10),

                      // Price and Location Row
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          // Daily Price Tag
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'RENTAL RATE',
                                style: TextStyle(
                                  fontSize: 9,
                                  color: AppColors.textMuted,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.baseline,
                                textBaseline: TextBaseline.alphabetic,
                                children: [
                                  Text(
                                    '₹${listing.pricePerDay.toStringAsFixed(0)}',
                                    style: const TextStyle(
                                      fontSize: 17,
                                      fontWeight: FontWeight.w900,
                                      color: Color(0xFF38BDF8), // Glowing Cyan Price
                                    ),
                                  ),
                                  const Text(
                                    ' /day',
                                    style: TextStyle(
                                      fontSize: 11,
                                      color: AppColors.textSecondary,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),

                          // Location Pill
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: const Color(0x331E293B),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: const Color(0x2538BDF8),
                                width: 0.8,
                              ),
                            ),
                            child: Row(
                              children: [
                                const Icon(
                                  Icons.location_on_rounded,
                                  size: 11,
                                  color: AppColors.accent,
                                ),
                                const SizedBox(width: 3),
                                ConstrainedBox(
                                  constraints: const BoxConstraints(maxWidth: 80),
                                  child: Text(
                                    listing.locationName.split(',').first,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w600,
                                      color: AppColors.textSecondary,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
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

typedef ListingCard = MobileListingCard;
