import 'dart:math' as math;
import 'dart:ui';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../models/listing_model.dart';
import '../../providers/auth_provider.dart';
import '../../providers/chat_provider.dart';
import '../../widgets/ambient_background.dart';
import '../../widgets/glass_container.dart';

class ListingDetailScreen extends ConsumerStatefulWidget {
  final String listingId;
  final ListingModel? initialListing;

  const ListingDetailScreen({
    super.key,
    required this.listingId,
    this.initialListing,
  });

  @override
  ConsumerState<ListingDetailScreen> createState() =>
      _ListingDetailScreenState();
}

class _ListingDetailScreenState extends ConsumerState<ListingDetailScreen> {
  bool _isWishlisted = false;
  int _activeImageIndex = 0;
  final _inquiryController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _isWishlisted = widget.initialListing?.isWishlisted ?? false;
  }

  @override
  void dispose() {
    _inquiryController.dispose();
    super.dispose();
  }

  void _showReportDialog(String id, String type) {
    final reasonController = TextEditingController();
    final detailsController = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFA0A1128),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: Color(0x4D38BDF8)),
        ),
        title: Text('Report $type',
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: reasonController,
              style: const TextStyle(color: Colors.white, fontSize: 13),
              decoration: const InputDecoration(
                  hintText: 'Reason (e.g. spam, fake listing, fraud)'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: detailsController,
              maxLines: 2,
              style: const TextStyle(color: Colors.white, fontSize: 13),
              decoration: const InputDecoration(
                  hintText: 'Additional details (optional)'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              try {
                await apiClient.dio.post('/reports', data: {
                  'reported_id': id,
                  'report_type': type,
                  'reason': reasonController.text.trim().isEmpty
                      ? 'Policy violation'
                      : reasonController.text.trim(),
                  'details': detailsController.text.trim(),
                });
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    backgroundColor: Color(0xFF0F2454),
                    content: Text('Report submitted to moderation team.',
                        style: TextStyle(
                            color: AppColors.accent, fontWeight: FontWeight.bold)),
                  ),
                );
              } catch (e) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                      backgroundColor: Colors.red, content: Text('Report failed: $e')),
                );
              }
            },
            child: const Text('Submit Report'),
          ),
        ],
      ),
    );
  }

  void _showRequestToRentSheet(ListingModel listing) {
    final authState = ref.read(authProvider);
    if (!authState.isAuthenticated) {
      context.push('/auth');
      return;
    }

    DateTime startDate = DateTime.now().add(const Duration(days: 1));
    DateTime endDate = DateTime.now().add(Duration(
        days: listing.minRentalDays > 1 ? listing.minRentalDays + 1 : 3));
    final notesController = TextEditingController();
    bool isSubmitting = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          final diffDays =
              math.max(1, endDate.difference(startDate).inDays);

          // Tiered price calculation
          int remainingDays = diffDays;
          int months = 0;
          int weeks = 0;
          double totalPrice = 0;

          if (listing.pricePerMonth != null &&
              listing.pricePerMonth! > 0 &&
              remainingDays >= 30) {
            months = remainingDays ~/ 30;
            totalPrice += months * listing.pricePerMonth!;
            remainingDays %= 30;
          }

          if (listing.pricePerWeek != null &&
              listing.pricePerWeek! > 0 &&
              remainingDays >= 7) {
            weeks = remainingDays ~/ 7;
            totalPrice += weeks * listing.pricePerWeek!;
            remainingDays %= 7;
          }

          totalPrice += remainingDays * listing.pricePerDay;
          final deposit = listing.depositAmount;
          final totalHandover = totalPrice + deposit;

          final hasDurationError = (diffDays < listing.minRentalDays) ||
              (diffDays > listing.maxRentalDays);

          return BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
            child: Container(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 20,
                bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
              ),
              decoration: const BoxDecoration(
                color: Color(0xFA0A1128),
                borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
                border: Border(
                    top: BorderSide(color: Color(0x4D38BDF8), width: 1.5)),
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Center(
                      child: Container(
                        width: 44,
                        height: 4,
                        decoration: BoxDecoration(
                          color: AppColors.textMuted.withOpacity(0.4),
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Request to Rent',
                          style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w900,
                              color: AppColors.textPrimary),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close_rounded,
                              color: AppColors.textMuted),
                          onPressed: () => Navigator.pop(ctx),
                        ),
                      ],
                    ),
                    const Text(
                      'Direct peer rental • 0% Platform Commission',
                      style: TextStyle(
                          fontSize: 12,
                          color: AppColors.success,
                          fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 16),

                    // Date range picker card
                    InkWell(
                      onTap: () async {
                        final picked = await showDateRangePicker(
                          context: ctx,
                          firstDate: DateTime.now(),
                          lastDate:
                              DateTime.now().add(const Duration(days: 180)),
                          initialDateRange:
                              DateTimeRange(start: startDate, end: endDate),
                        );
                        if (picked != null) {
                          setSheetState(() {
                            startDate = picked.start;
                            endDate = picked.end;
                          });
                        }
                      },
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: const Color(0x2B1E293B),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: const Color(0x3538BDF8)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.calendar_month_rounded,
                                color: AppColors.accent, size: 22),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text('Selected Dates (Tap to change)',
                                      style: TextStyle(
                                          fontSize: 11,
                                          color: AppColors.textMuted)),
                                  const SizedBox(height: 4),
                                  Text(
                                    '${startDate.year}-${startDate.month.toString().padLeft(2, '0')}-${startDate.day.toString().padLeft(2, '0')}  →  ${endDate.year}-${endDate.month.toString().padLeft(2, '0')}-${endDate.day.toString().padLeft(2, '0')}',
                                    style: const TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w800,
                                        color: AppColors.textPrimary),
                                  ),
                                ],
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: AppColors.primary.withOpacity(0.2),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Text(
                                '$diffDays Day(s)',
                                style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w800,
                                    color: AppColors.accent),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),

                    if (hasDurationError)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                          'Duration must be between ${listing.minRentalDays} and ${listing.maxRentalDays} days.',
                          style: const TextStyle(
                              fontSize: 11,
                              color: Colors.redAccent,
                              fontWeight: FontWeight.bold),
                        ),
                      ),

                    const SizedBox(height: 16),

                    // Pricing breakdown card
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: const Color(0x220284C7),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0x3338BDF8)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Pricing Breakdown (Tiered)',
                              style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.accent)),
                          const SizedBox(height: 8),
                          if (months > 0)
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                    '$months Month(s) @ ₹${listing.pricePerMonth!.toInt()}/mo',
                                    style: const TextStyle(
                                        fontSize: 12,
                                        color: AppColors.textSecondary)),
                                Text('₹${(months * listing.pricePerMonth!).toInt()}',
                                    style: const TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w700,
                                        color: AppColors.textPrimary)),
                              ],
                            ),
                          if (weeks > 0)
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                    '$weeks Week(s) @ ₹${listing.pricePerWeek!.toInt()}/wk',
                                    style: const TextStyle(
                                        fontSize: 12,
                                        color: AppColors.textSecondary)),
                                Text('₹${(weeks * listing.pricePerWeek!).toInt()}',
                                    style: const TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w700,
                                        color: AppColors.textPrimary)),
                              ],
                            ),
                          if (remainingDays > 0)
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                    '$remainingDays Day(s) @ ₹${listing.pricePerDay.toInt()}/day',
                                    style: const TextStyle(
                                        fontSize: 12,
                                        color: AppColors.textSecondary)),
                                Text(
                                    '₹${(remainingDays * listing.pricePerDay).toInt()}',
                                    style: const TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w700,
                                        color: AppColors.textPrimary)),
                              ],
                            ),
                          const SizedBox(height: 6),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text('Rental Cost',
                                  style: TextStyle(
                                      fontSize: 12,
                                      color: AppColors.textSecondary)),
                              Text('₹${totalPrice.toInt()}',
                                  style: const TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.textPrimary)),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text('Refundable Security Deposit',
                                  style: TextStyle(
                                      fontSize: 12,
                                      color: AppColors.textSecondary)),
                              Text(deposit > 0 ? '₹${deposit.toInt()}' : '₹0',
                                  style: const TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.textPrimary)),
                            ],
                          ),
                          const Divider(color: Color(0x3338BDF8), height: 16),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text('Total on Handover',
                                  style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w900,
                                      color: AppColors.primaryLight)),
                              Text('₹${totalHandover.toInt()}',
                                  style: const TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w900,
                                      color: AppColors.accent)),
                            ],
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 14),

                    // Notes text field
                    TextField(
                      controller: notesController,
                      maxLines: 2,
                      style: const TextStyle(
                          fontSize: 13, color: AppColors.textPrimary),
                      decoration: InputDecoration(
                        hintText:
                            'Add an optional note to the owner (e.g. pickup time)...',
                        fillColor: const Color(0x2B1E293B),
                        border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14)),
                      ),
                    ),

                    const SizedBox(height: 18),

                    // Submit button
                    SizedBox(
                      width: double.infinity,
                      height: 50,
                      child: ElevatedButton(
                        onPressed: (isSubmitting || hasDurationError)
                            ? null
                            : () async {
                                setSheetState(() => isSubmitting = true);
                                try {
                                  final sStr =
                                      '${startDate.year}-${startDate.month.toString().padLeft(2, '0')}-${startDate.day.toString().padLeft(2, '0')}';
                                  final eStr =
                                      '${endDate.year}-${endDate.month.toString().padLeft(2, '0')}-${endDate.day.toString().padLeft(2, '0')}';

                                  await apiClient.dio.post('/rentals', data: {
                                    'listing_id': listing.id,
                                    'start_date': sStr,
                                    'end_date': eStr,
                                    'notes': notesController.text.trim(),
                                  });

                                  Navigator.pop(ctx);
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      backgroundColor: Color(0xFF0F2454),
                                      content: Text(
                                        'Rental Request Submitted Successfully!',
                                        style: TextStyle(
                                            color: AppColors.accent,
                                            fontWeight: FontWeight.bold),
                                      ),
                                    ),
                                  );
                                  context.push('/rentals');
                                } catch (err) {
                                  setSheetState(() => isSubmitting = false);
                                  String msg = 'Failed to submit rental request';
                                  if (err is DioException &&
                                      err.response?.data is Map) {
                                    msg = err.response?.data['error'] ?? msg;
                                  }
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      backgroundColor: const Color(0xFF7F1D1D),
                                      content: Text(msg,
                                          style: const TextStyle(
                                              color: Colors.white)),
                                    ),
                                  );
                                }
                              },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16)),
                        ),
                        child: isSubmitting
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                    color: Colors.white, strokeWidth: 2))
                            : const Text('Submit Rental Request',
                                style: TextStyle(
                                    fontWeight: FontWeight.w900,
                                    fontSize: 15,
                                    color: Colors.white)),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  void _showInquiryDialog(ListingModel listing) {
    final authState = ref.read(authProvider);
    if (!authState.isAuthenticated) {
      context.push('/auth');
      return;
    }

    _inquiryController.text =
        'Hi ${listing.owner?.fullName ?? 'there'}! I would like to rent your "${listing.title}". Is it available?';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return ClipRRect(
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
            child: Container(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 20,
                bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
              ),
              decoration: BoxDecoration(
                color: const Color(0xFA0A1128),
                borderRadius:
                    const BorderRadius.vertical(top: Radius.circular(28)),
                border: Border.all(color: const Color(0x4D38BDF8), width: 1.5),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: const [
                          Icon(Icons.chat_bubble_rounded,
                              color: AppColors.primary, size: 20),
                          SizedBox(width: 8),
                          Text(
                            'Chat with Owner',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w900,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ],
                      ),
                      IconButton(
                        icon: const Icon(Icons.close_rounded,
                            color: AppColors.textMuted),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Direct peer rental discussion. Agree on rental dates, return conditions, and handover without platform commission.',
                    style: TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                        height: 1.3),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _inquiryController,
                    maxLines: 3,
                    style: const TextStyle(
                        fontSize: 14, color: AppColors.textPrimary),
                    decoration: InputDecoration(
                      hintText: 'Type your message to the owner...',
                      fillColor: AppColors.background,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                        borderSide: BorderSide(color: AppColors.border),
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: ElevatedButton.icon(
                      onPressed: () async {
                        Navigator.pop(ctx);
                        final success = await ref
                            .read(chatProvider.notifier)
                            .sendRentalInquiry(
                              listing.id,
                              message: _inquiryController.text.trim(),
                            );
                        if (success && mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                                content: Text('Inquiry sent! Opening chat...')),
                          );
                          context.push('/chat');
                        }
                      },
                      icon: const Icon(Icons.send_rounded, size: 18),
                      label: const Text(
                        'Start Conversation',
                        style: TextStyle(
                            fontSize: 15, fontWeight: FontWeight.w800),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16)),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final listing = widget.initialListing;

    if (listing == null) {
      return Scaffold(
        appBar: AppBar(),
        body: const Center(
            child: CircularProgressIndicator(color: AppColors.primary)),
      );
    }

    final images = listing.images.isNotEmpty
        ? listing.images
        : [
            'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=600&q=80'
          ];

    return Scaffold(
      extendBodyBehindAppBar: true,
      body: AmbientBackground(
        child: Stack(
          children: [
            CustomScrollView(
              slivers: [
                // Full-width Image Gallery Header
                SliverAppBar(
                  expandedHeight: 340,
                  pinned: true,
                  backgroundColor: Colors.transparent,
                  leading: Padding(
                    padding: const EdgeInsets.only(left: 14),
                    child: Center(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(20),
                        child: BackdropFilter(
                          filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                          child: Container(
                            width: 38,
                            height: 38,
                            decoration: BoxDecoration(
                              color: const Color(0xCC091226),
                              shape: BoxShape.circle,
                              border:
                                  Border.all(color: const Color(0x4038BDF8)),
                            ),
                            child: IconButton(
                              icon: const Icon(Icons.arrow_back_rounded,
                                  size: 18, color: AppColors.textPrimary),
                              padding: EdgeInsets.zero,
                              onPressed: () => context.pop(),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                  actions: [
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(20),
                        child: BackdropFilter(
                          filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                          child: Container(
                            width: 38,
                            height: 38,
                            decoration: BoxDecoration(
                              color: const Color(0xCC091226),
                              shape: BoxShape.circle,
                              border:
                                  Border.all(color: const Color(0x4038BDF8)),
                            ),
                            child: IconButton(
                              icon: Icon(
                                _isWishlisted
                                    ? Icons.favorite_rounded
                                    : Icons.favorite_border_rounded,
                                size: 18,
                                color: _isWishlisted
                                    ? AppColors.error
                                    : AppColors.textPrimary,
                              ),
                              padding: EdgeInsets.zero,
                              onPressed: () {
                                setState(() => _isWishlisted = !_isWishlisted);
                              },
                            ),
                          ),
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(20),
                        child: BackdropFilter(
                          filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                          child: Container(
                            width: 38,
                            height: 38,
                            decoration: BoxDecoration(
                              color: const Color(0xCC091226),
                              shape: BoxShape.circle,
                              border:
                                  Border.all(color: const Color(0x4038BDF8)),
                            ),
                            child: IconButton(
                              icon: const Icon(Icons.flag_outlined,
                                  size: 18, color: Colors.redAccent),
                              padding: EdgeInsets.zero,
                              onPressed: () =>
                                  _showReportDialog(listing.id, 'listing'),
                            ),
                          ),
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.only(right: 14),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(20),
                        child: BackdropFilter(
                          filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                          child: Container(
                            width: 38,
                            height: 38,
                            decoration: BoxDecoration(
                              color: const Color(0xCC091226),
                              shape: BoxShape.circle,
                              border:
                                  Border.all(color: const Color(0x4038BDF8)),
                            ),
                            child: IconButton(
                              icon: const Icon(Icons.share_rounded,
                                  size: 18, color: AppColors.textPrimary),
                              padding: EdgeInsets.zero,
                              onPressed: () {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                      content: Text('Listing link copied!')),
                                );
                              },
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                  flexibleSpace: FlexibleSpaceBar(
                    background: Stack(
                      children: [
                        PageView.builder(
                          itemCount: images.length,
                          onPageChanged: (idx) =>
                              setState(() => _activeImageIndex = idx),
                          itemBuilder: (context, idx) {
                            return Image.network(
                              images[idx],
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => Container(
                                color: AppColors.backgroundSecondary,
                                child: const Icon(Icons.broken_image,
                                    size: 48, color: AppColors.textMuted),
                              ),
                            );
                          },
                        ),
                        // Page indicator
                        if (images.length > 1)
                          Positioned(
                            bottom: 16,
                            left: 0,
                            right: 0,
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: List.generate(images.length, (idx) {
                                return Container(
                                  width: _activeImageIndex == idx ? 20 : 6,
                                  height: 6,
                                  margin:
                                      const EdgeInsets.symmetric(horizontal: 3),
                                  decoration: BoxDecoration(
                                    color: _activeImageIndex == idx
                                        ? AppColors.primary
                                        : Colors.white.withOpacity(0.7),
                                    borderRadius: BorderRadius.circular(3),
                                  ),
                                );
                              }),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),

                // Content Section
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 20, 16, 120),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Category & Condition
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: AppColors.light,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                    color: AppColors.accent.withOpacity(0.3)),
                              ),
                              child: Text(
                                listing.category.toUpperCase(),
                                style: const TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.primary,
                                  letterSpacing: 0.6,
                                ),
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: AppColors.navy.withOpacity(0.85),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Text(
                                listing.condition
                                    .replaceAll('_', ' ')
                                    .toUpperCase(),
                                style: const TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                  color: Colors.white,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),

                        // Title
                        Text(
                          listing.title,
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w900,
                            color: AppColors.textPrimary,
                            letterSpacing: -0.4,
                          ),
                        ),
                        const SizedBox(height: 6),

                        // Location
                        Row(
                          children: [
                            const Icon(Icons.location_on_rounded,
                                size: 14, color: AppColors.primary),
                            const SizedBox(width: 4),
                            Text(
                              listing.locationName,
                              style: const TextStyle(
                                fontSize: 13,
                                color: AppColors.textSecondary,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 18),

                        // Price & Security Deposit Panel (Glass Level 2)
                        GlassContainer(
                          level: GlassLevel.standard,
                          padding: const EdgeInsets.all(18),
                          borderRadius: BorderRadius.circular(22),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  RichText(
                                    text: TextSpan(
                                      children: [
                                        TextSpan(
                                          text:
                                              '₹${listing.pricePerDay.toInt()}',
                                          style: const TextStyle(
                                            fontSize: 26,
                                            fontWeight: FontWeight.w900,
                                            color: AppColors.primary,
                                          ),
                                        ),
                                        const TextSpan(
                                          text: ' / day',
                                          style: TextStyle(
                                            fontSize: 14,
                                            fontWeight: FontWeight.w600,
                                            color: AppColors.textSecondary,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  const Text(
                                    '0% platform commission',
                                    style: TextStyle(
                                      fontSize: 11,
                                      color: AppColors.success,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ],
                              ),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  const Text(
                                    'Security Deposit',
                                    style: TextStyle(
                                        fontSize: 11,
                                        color: AppColors.textMuted,
                                        fontWeight: FontWeight.w600),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    listing.depositAmount > 0
                                        ? '₹${listing.depositAmount.toInt()}'
                                        : 'Zero Deposit',
                                    style: const TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.w900,
                                      color: AppColors.textPrimary,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),

                        const SizedBox(height: 16),

                        // Owner Profile with Trust Score (Glass Level 2)
                        GlassContainer(
                          level: GlassLevel.standard,
                          padding: const EdgeInsets.all(16),
                          borderRadius: BorderRadius.circular(22),
                          child: Row(
                            children: [
                              Container(
                                width: 48,
                                height: 48,
                                decoration: BoxDecoration(
                                  gradient: const LinearGradient(
                                    colors: [
                                      AppColors.primary,
                                      AppColors.accent
                                    ],
                                  ),
                                  shape: BoxShape.circle,
                                ),
                                alignment: Alignment.center,
                                child: Text(
                                  listing.owner?.fullName.characters.first ??
                                      'H',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w900,
                                    fontSize: 18,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Text(
                                          listing.owner?.fullName ??
                                              'skipit Verified Host',
                                          style: const TextStyle(
                                            fontSize: 15,
                                            fontWeight: FontWeight.w800,
                                            color: AppColors.textPrimary,
                                          ),
                                        ),
                                        if (listing.owner?.isVerified ==
                                            true) ...[
                                          const SizedBox(width: 4),
                                          const Icon(Icons.verified_rounded,
                                              size: 15,
                                              color: AppColors.primary),
                                        ],
                                      ],
                                    ),
                                    const SizedBox(height: 4),
                                    Row(
                                      children: [
                                        const Icon(Icons.star_rounded,
                                            size: 14, color: AppColors.warning),
                                        const SizedBox(width: 2),
                                        Text(
                                          listing.owner?.rating
                                                  .toStringAsFixed(1) ??
                                              '5.0',
                                          style: const TextStyle(
                                              fontSize: 12,
                                              fontWeight: FontWeight.w800),
                                        ),
                                        const SizedBox(width: 10),
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                              horizontal: 6, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: AppColors.light,
                                            borderRadius:
                                                BorderRadius.circular(6),
                                          ),
                                          child: Text(
                                            'Trust Score ${listing.owner?.trustScore ?? 85}/100',
                                            style: const TextStyle(
                                              fontSize: 10,
                                              color: AppColors.primary,
                                              fontWeight: FontWeight.w800,
                                            ),
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

                        const SizedBox(height: 20),

                        // Description
                        const Text(
                          'Product Overview',
                          style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w900,
                              color: AppColors.textPrimary),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          listing.description,
                          style: const TextStyle(
                            fontSize: 14,
                            height: 1.5,
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w500,
                          ),
                        ),

                        const SizedBox(height: 20),

                        // Rental Terms & Direct Agreement Notice
                        GlassContainer(
                          level: GlassLevel.subtle,
                          padding: const EdgeInsets.all(16),
                          borderRadius: BorderRadius.circular(20),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: const [
                              Row(
                                children: [
                                  Icon(Icons.shield_outlined,
                                      size: 16, color: AppColors.primary),
                                  SizedBox(width: 6),
                                  Text(
                                    'SkipIt Peer-to-Peer Agreement',
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w800,
                                      color: AppColors.textPrimary,
                                    ),
                                  ),
                                ],
                              ),
                              SizedBox(height: 8),
                              Text(
                                '• Inspect and test device before rental begins\n• No commission charged by SkipIt\n• Rental fee and deposits are settled directly between parties',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: AppColors.textSecondary,
                                  height: 1.5,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),

            // Floating Glass Bottom Action Panel (Chat with Owner)
            Positioned(
              bottom: 16,
              left: 16,
              right: 16,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(24),
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: const Color(0xCC091226),
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(
                          color: const Color(0x4038BDF8), width: 1.2),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF00C6FF).withOpacity(0.12),
                          blurRadius: 20,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '₹${listing.pricePerDay.toInt()}/day',
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w900,
                                color: AppColors.primary,
                              ),
                            ),
                            const Text(
                              'Direct Rental',
                              style: TextStyle(
                                fontSize: 10,
                                color: AppColors.textMuted,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(width: 14),
                        if (listing.ownerId == ref.watch(authProvider).user?.id) ...[
                          Expanded(
                            child: ElevatedButton.icon(
                              icon: const Icon(Icons.edit_rounded, size: 18),
                              label: const Text('Edit Listing',
                                  style: TextStyle(fontWeight: FontWeight.bold)),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.primary,
                                shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(16)),
                                padding: const EdgeInsets.symmetric(vertical: 14),
                              ),
                              onPressed: () => context.push('/edit-listing/${listing.id}', extra: listing),
                            ),
                          ),
                        ] else ...[
                          InkWell(
                            onTap: () => _showInquiryDialog(listing),
                            borderRadius: BorderRadius.circular(16),
                            child: Container(
                              width: 48,
                              height: 48,
                              decoration: BoxDecoration(
                                color: const Color(0x331E293B),
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: const Color(0x3538BDF8)),
                              ),
                              child: const Icon(Icons.chat_bubble_outline_rounded,
                                  color: AppColors.accent, size: 20),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: GestureDetector(
                              onTap: () => _showRequestToRentSheet(listing),
                              child: Container(
                                height: 48,
                                decoration: BoxDecoration(
                                  gradient: const LinearGradient(
                                    colors: [AppColors.primary, AppColors.accent],
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                  ),
                                  borderRadius: BorderRadius.circular(16),
                                  boxShadow: [
                                    BoxShadow(
                                      color: AppColors.primary.withOpacity(0.35),
                                      blurRadius: 12,
                                      offset: const Offset(0, 4),
                                    ),
                                  ],
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: const [
                                    Icon(Icons.calendar_month_rounded,
                                        color: Colors.white, size: 18),
                                    SizedBox(width: 8),
                                    Text(
                                      'Request to Rent',
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontSize: 14,
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
