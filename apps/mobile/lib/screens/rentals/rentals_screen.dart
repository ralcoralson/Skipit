import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../models/rental_model.dart';
import '../../widgets/ambient_background.dart';
import '../../widgets/glass_container.dart';

class RentalsScreen extends ConsumerStatefulWidget {
  const RentalsScreen({super.key});

  @override
  ConsumerState<RentalsScreen> createState() => _RentalsScreenState();
}

class _RentalsScreenState extends ConsumerState<RentalsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<RentalModel> _myRequests = [];
  List<RentalModel> _incomingRequests = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _fetchRentals();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _fetchRentals() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final responses = await Future.wait([
        apiClient.dio.get('/rentals/my-requests'),
        apiClient.dio.get('/rentals/incoming'),
      ]);

      final myData = responses[0].data['rentals'] as List? ?? [];
      final incomingData = responses[1].data['rentals'] as List? ?? [];

      setState(() {
        _myRequests = myData.map((e) => RentalModel.fromJson(e)).toList();
        _incomingRequests =
            incomingData.map((e) => RentalModel.fromJson(e)).toList();
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
        _error = 'Failed to load rentals: $e';
      });
    }
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'accepted':
        return const Color(0xFF10B981); // Emerald
      case 'completed':
        return const Color(0xFF8B5CF6); // Purple
      case 'rejected':
      case 'cancelled':
        return const Color(0xFFEF4444); // Red
      case 'pending':
      default:
        return const Color(0xFFF59E0B); // Amber
    }
  }

  Widget _buildRentalCard(RentalModel rental, {required bool isOwner}) {
    final statusColor = _getStatusColor(rental.requestStatus);
    final partner = isOwner ? rental.renter : rental.owner;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      child: GlassContainer(
        level: GlassLevel.subtle,
        borderRadius: BorderRadius.circular(18),
        padding: const EdgeInsets.all(16),
        child: InkWell(
          onTap: () {
            context.push('/rentals/${rental.id}', extra: rental).then((_) {
              _fetchRentals();
            });
          },
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      rental.listing?.title ?? 'Rental Item',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: statusColor.withOpacity(0.18),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                          color: statusColor.withOpacity(0.5), width: 1),
                    ),
                    child: Text(
                      rental.requestStatus.toUpperCase(),
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w900,
                        color: statusColor,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  const Icon(Icons.date_range_rounded,
                      size: 15, color: AppColors.accent),
                  const SizedBox(width: 6),
                  Text(
                    '${rental.startDate}  →  ${rental.endDate} (${rental.totalDays}d)',
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.textSecondary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.person_outline_rounded,
                          size: 15, color: AppColors.textMuted),
                      const SizedBox(width: 6),
                      Text(
                        isOwner
                            ? 'Renter: ${partner?.fullName ?? 'Anonymous'}'
                            : 'Owner: ${partner?.fullName ?? 'Anonymous'}',
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.textMuted,
                        ),
                      ),
                    ],
                  ),
                  Text(
                    '₹${rental.totalPrice.toInt()}${rental.securityDeposit > 0 ? ' + ₹${rental.securityDeposit.toInt()} dep' : ''}',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                      color: AppColors.primaryLight,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildList(List<RentalModel> list, {required bool isOwner}) {
    if (list.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.inventory_2_outlined,
                size: 54, color: AppColors.textMuted.withOpacity(0.5)),
            const SizedBox(height: 14),
            Text(
              isOwner
                  ? 'No incoming rental requests yet'
                  : 'You have not submitted any rental requests',
              style: const TextStyle(
                fontSize: 14,
                color: AppColors.textSecondary,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Direct peer-to-peer rental • 0% Commission',
              style: TextStyle(
                fontSize: 11,
                color: AppColors.textMuted,
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _fetchRentals,
      color: AppColors.primary,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
        itemCount: list.length,
        itemBuilder: (ctx, idx) =>
            _buildRentalCard(list[idx], isOwner: isOwner),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: AmbientBackground(
        child: SafeArea(
          child: Column(
            children: [
              // Header
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        IconButton(
                          icon: const Icon(Icons.arrow_back_ios_new_rounded,
                              color: AppColors.textPrimary, size: 20),
                          onPressed: () => context.pop(),
                        ),
                        const SizedBox(width: 4),
                        const Text(
                          'Rentals Hub',
                          style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w900,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ],
                    ),
                    IconButton(
                      icon: const Icon(Icons.refresh_rounded,
                          color: AppColors.accent),
                      onPressed: _fetchRentals,
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 8),

              // Tabs
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 16),
                decoration: BoxDecoration(
                  color: const Color(0x330F1E3D),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0x3538BDF8), width: 1),
                ),
                child: TabBar(
                  controller: _tabController,
                  indicatorColor: AppColors.primary,
                  indicatorWeight: 3,
                  labelColor: AppColors.accent,
                  unselectedLabelColor: AppColors.textMuted,
                  tabs: [
                    Tab(
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.outbox_rounded, size: 16),
                          const SizedBox(width: 6),
                          Text('My Requests (${_myRequests.length})'),
                        ],
                      ),
                    ),
                    Tab(
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.inbox_rounded, size: 16),
                          const SizedBox(width: 6),
                          Text('Incoming (${_incomingRequests.length})'),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              // Tab Views
              Expanded(
                child: _isLoading
                    ? const Center(
                        child: CircularProgressIndicator(
                            color: AppColors.primary))
                    : _error != null
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(_error!,
                                    style: const TextStyle(
                                        color: Colors.redAccent)),
                                const SizedBox(height: 12),
                                ElevatedButton(
                                  onPressed: _fetchRentals,
                                  child: const Text('Retry'),
                                ),
                              ],
                            ),
                          )
                        : TabBarView(
                            controller: _tabController,
                            children: [
                              _buildList(_myRequests, isOwner: false),
                              _buildList(_incomingRequests, isOwner: true),
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
