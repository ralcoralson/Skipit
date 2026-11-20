import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../models/rental_model.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/ambient_background.dart';
import '../../widgets/glass_container.dart';

class RentalDetailScreen extends ConsumerStatefulWidget {
  final String rentalId;
  final RentalModel? initialRental;

  const RentalDetailScreen({
    super.key,
    required this.rentalId,
    this.initialRental,
  });

  @override
  ConsumerState<RentalDetailScreen> createState() => _RentalDetailScreenState();
}

class _RentalDetailScreenState extends ConsumerState<RentalDetailScreen> {
  RentalModel? _rental;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _rental = widget.initialRental;
    _fetchDetails();
  }

  Future<void> _fetchDetails() async {
    try {
      final res = await apiClient.dio.get('/rentals/${widget.rentalId}');
      if (res.data['rental'] != null) {
        setState(() {
          _rental = RentalModel.fromJson(res.data['rental']);
          _isLoading = false;
        });
      }
    } catch (e) {
      if (_rental == null) {
        setState(() {
          _error = 'Failed to load rental details: $e';
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _respondRental(String status, {String? note}) async {
    try {
      await apiClient.dio.patch('/rentals/${widget.rentalId}/respond', data: {
        'status': status,
        'response_note': note ?? '',
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: const Color(0xFF0F2454),
          content: Text(
            status == 'accepted' ? 'Rental Request Accepted!' : 'Rental Request Declined',
            style: const TextStyle(color: AppColors.accent, fontWeight: FontWeight.bold),
          ),
        ),
      );
      _fetchDetails();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: const Color(0xFF7F1D1D),
          content: Text('Action failed: $e', style: const TextStyle(color: Colors.white)),
        ),
      );
    }
  }

  Future<void> _cancelRental() async {
    try {
      await apiClient.dio.patch('/rentals/${widget.rentalId}/cancel');
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: Color(0xFF7F1D1D),
          content: Text('Rental Request Cancelled', style: TextStyle(color: Colors.white)),
        ),
      );
      _fetchDetails();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: const Color(0xFF7F1D1D),
          content: Text('Failed to cancel: $e', style: const TextStyle(color: Colors.white)),
        ),
      );
    }
  }

  Future<void> _completeRental() async {
    try {
      await apiClient.dio.post('/rentals/${widget.rentalId}/complete');
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: Color(0xFF0F2454),
          content: Text('Rental Marked as Completed! Total rentals incremented.',
              style: TextStyle(color: AppColors.accent, fontWeight: FontWeight.bold)),
        ),
      );
      _fetchDetails();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: const Color(0xFF7F1D1D),
          content: Text('Failed to mark complete: $e', style: const TextStyle(color: Colors.white)),
        ),
      );
    }
  }

  void _showReviewDialog(String revieweeId) {
    int rating = 5;
    final commentCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDlgState) => AlertDialog(
          backgroundColor: const Color(0xFA0A1128),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: const BorderSide(color: Color(0x4D38BDF8)),
          ),
          title: const Text('Leave Verified Review',
              style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w900)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Share your rental experience. Verified rental reviews directly influence community trust scores.',
                style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(5, (index) {
                  final starNum = index + 1;
                  return IconButton(
                    icon: Icon(
                      starNum <= rating ? Icons.star_rounded : Icons.star_border_rounded,
                      color: const Color(0xFFFBBF24),
                      size: 32,
                    ),
                    onPressed: () => setDlgState(() => rating = starNum),
                  );
                }),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: commentCtrl,
                maxLines: 3,
                style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
                decoration: InputDecoration(
                  hintText: 'Write a few words about item condition or return punctuality...',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel', style: TextStyle(color: AppColors.textMuted)),
            ),
            ElevatedButton(
              onPressed: () async {
                Navigator.pop(ctx);
                try {
                  await apiClient.dio.post('/reviews', data: {
                    'rental_request_id': widget.rentalId,
                    'reviewee_id': revieweeId,
                    'rating': rating,
                    'comment': commentCtrl.text.trim(),
                  });
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      backgroundColor: Color(0xFF0F2454),
                      content: Text('Review submitted successfully!',
                          style: TextStyle(color: AppColors.accent, fontWeight: FontWeight.bold)),
                    ),
                  );
                  _fetchDetails();
                } catch (err) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      backgroundColor: const Color(0xFF7F1D1D),
                      content: Text('Review failed: $err', style: const TextStyle(color: Colors.white)),
                    ),
                  );
                }
              },
              child: const Text('Submit Review'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final currentUserId = ref.watch(authProvider).user?.id;
    final rental = _rental;

    if (_isLoading && rental == null) {
      return const Scaffold(
        backgroundColor: AppColors.background,
        body: Center(child: CircularProgressIndicator(color: AppColors.primary)),
      );
    }

    if (rental == null) {
      return Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(title: const Text('Rental Request')),
        body: Center(
          child: Text(_error ?? 'Rental request not found', style: const TextStyle(color: Colors.white)),
        ),
      );
    }

    final isOwner = rental.ownerId == currentUserId;
    final partner = isOwner ? rental.renter : rental.owner;
    final partnerRole = isOwner ? 'Renter' : 'Owner';

    return Scaffold(
      backgroundColor: AppColors.background,
      body: AmbientBackground(
        child: SafeArea(
          child: Column(
            children: [
              // Header
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
                      'Rental Details',
                      style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: AppColors.textPrimary),
                    ),
                  ],
                ),
              ),

              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
                  children: [
                    // Item & Status Summary
                    GlassContainer(
                      level: GlassLevel.standard,
                      borderRadius: BorderRadius.circular(20),
                      padding: const EdgeInsets.all(18),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Text(
                                  rental.listing?.title ?? 'Direct Peer Item',
                                  style: const TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.w900,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                                decoration: BoxDecoration(
                                  color: const Color(0x3310B981),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: const Color(0x8010B981)),
                                ),
                                child: Text(
                                  rental.requestStatus.toUpperCase(),
                                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF10B981)),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          const Divider(color: Color(0x2038BDF8)),
                          const SizedBox(height: 12),

                          // Dates & Duration
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text('Rental Period', style: TextStyle(fontSize: 11, color: AppColors.textMuted)),
                                  const SizedBox(height: 4),
                                  Text('${rental.startDate} → ${rental.endDate}',
                                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                                ],
                              ),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  const Text('Duration', style: TextStyle(fontSize: 11, color: AppColors.textMuted)),
                                  const SizedBox(height: 4),
                                  Text('${rental.totalDays} Day(s)',
                                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.accent)),
                                ],
                              ),
                            ],
                          ),

                          const SizedBox(height: 16),

                          // Pricing Breakdown
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: const Color(0x2B1E293B),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: Column(
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    const Text('Rental Fee (0% Commission)', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                                    Text('₹${rental.totalPrice.toInt()}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    const Text('Refundable Security Deposit', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                                    Text(rental.securityDeposit > 0 ? '₹${rental.securityDeposit.toInt()}' : '₹0',
                                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                                  ],
                                ),
                                const Divider(color: Color(0x2038BDF8), height: 16),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    const Text('Total Payable on Handover',
                                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: AppColors.primaryLight)),
                                    Text('₹${(rental.totalPrice + rental.securityDeposit).toInt()}',
                                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: AppColors.accent)),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 16),

                    // Counterpart Details Card
                    GlassContainer(
                      level: GlassLevel.subtle,
                      borderRadius: BorderRadius.circular(20),
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('$partnerRole Profile', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              CircleAvatar(
                                radius: 22,
                                backgroundImage: partner?.avatarUrl != null ? NetworkImage(partner!.avatarUrl!) : null,
                                child: partner?.avatarUrl == null ? const Icon(Icons.person) : null,
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(partner?.fullName ?? 'SkipIt Member',
                                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
                                    Text('Trust Score: ${partner?.trustScore ?? 50}/100 • Total Rentals: ${partner?.totalRentals ?? 0}',
                                        style: const TextStyle(fontSize: 11, color: AppColors.accent)),
                                    if (rental.requestStatus == 'accepted' && partner?.phoneNumber != null)
                                      Padding(
                                        padding: const EdgeInsets.only(top: 4),
                                        child: Text('Phone: ${partner!.phoneNumber}',
                                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF10B981))),
                                      ),
                                  ],
                                ),
                              ),
                              IconButton(
                                icon: const Icon(Icons.chat_bubble_outline_rounded, color: AppColors.accent),
                                onPressed: () {
                                  if (partner?.id != null) {
                                    context.push('/chat/${partner!.id}');
                                  }
                                },
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 24),

                    // Action Buttons based on status & role
                    if (isOwner && rental.requestStatus == 'pending') ...[
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton(
                              onPressed: () => _respondRental('rejected'),
                              style: OutlinedButton.styleFrom(
                                side: const BorderSide(color: Colors.redAccent),
                                padding: const EdgeInsets.symmetric(vertical: 14),
                              ),
                              child: const Text('Decline', style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold)),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: ElevatedButton(
                              onPressed: () => _respondRental('accepted'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF10B981),
                                padding: const EdgeInsets.symmetric(vertical: 14),
                              ),
                              child: const Text('Accept Request', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
                            ),
                          ),
                        ],
                      ),
                    ],

                    if (isOwner && rental.requestStatus == 'accepted') ...[
                      ElevatedButton.icon(
                        icon: const Icon(Icons.check_circle_outline_rounded),
                        label: const Text('Mark Rental Completed', style: TextStyle(fontWeight: FontWeight.bold)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF8B5CF6),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        onPressed: _completeRental,
                      ),
                      const SizedBox(height: 12),
                    ],

                    if ((rental.requestStatus == 'pending' || rental.requestStatus == 'accepted')) ...[
                      OutlinedButton(
                        onPressed: _cancelRental,
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: Color(0x40EF4444)),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                        child: const Text('Cancel Rental Request', style: TextStyle(color: Colors.redAccent)),
                      ),
                      const SizedBox(height: 12),
                    ],

                    if (rental.requestStatus == 'completed') ...[
                      ElevatedButton.icon(
                        icon: const Icon(Icons.rate_review_outlined),
                        label: const Text('Leave Verified Review', style: TextStyle(fontWeight: FontWeight.bold)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        onPressed: () => _showReviewDialog(isOwner ? rental.renterId : rental.ownerId),
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
