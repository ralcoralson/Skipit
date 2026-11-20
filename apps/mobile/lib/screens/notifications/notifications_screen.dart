import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/ambient_background.dart';
import '../../widgets/glass_container.dart';

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  List<dynamic> _notifications = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchNotifications();
  }

  Future<void> _fetchNotifications() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final res = await apiClient.dio.get('/notifications');
      setState(() {
        _notifications = res.data['notifications'] as List? ?? [];
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
        _error = 'Failed to load notifications: $e';
      });
    }
  }

  Future<void> _markRead(String id, int index) async {
    try {
      await apiClient.dio.patch('/notifications/$id/read');
      setState(() {
        _notifications[index]['is_read'] = true;
      });
    } catch (_) {}
  }

  Future<void> _markAllRead() async {
    try {
      await apiClient.dio.patch('/notifications/read-all');
      setState(() {
        for (var n in _notifications) {
          n['is_read'] = true;
        }
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: Color(0xFF0F2454),
          content: Text('All notifications marked as read', style: TextStyle(color: AppColors.accent)),
        ),
      );
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final unreadCount = _notifications.where((n) => n['is_read'] == false).length;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: AmbientBackground(
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        IconButton(
                          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: AppColors.textPrimary, size: 20),
                          onPressed: () => context.pop(),
                        ),
                        const SizedBox(width: 8),
                        const Text(
                          'Notifications',
                          style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: AppColors.textPrimary),
                        ),
                      ],
                    ),
                    if (unreadCount > 0)
                      TextButton.icon(
                        icon: const Icon(Icons.done_all_rounded, size: 16, color: AppColors.accent),
                        label: const Text('Mark all read', style: TextStyle(color: AppColors.accent, fontSize: 12)),
                        onPressed: _markAllRead,
                      ),
                  ],
                ),
              ),

              Expanded(
                child: _isLoading
                    ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                    : _error != null
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(_error!, style: const TextStyle(color: Colors.redAccent)),
                                const SizedBox(height: 12),
                                ElevatedButton(onPressed: _fetchNotifications, child: const Text('Retry')),
                              ],
                            ),
                          )
                        : _notifications.isEmpty
                            ? Center(
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(Icons.notifications_none_rounded, size: 56, color: AppColors.textMuted.withOpacity(0.4)),
                                    const SizedBox(height: 14),
                                    const Text('No notifications yet',
                                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
                                    const SizedBox(height: 6),
                                    const Text('You will be alerted about rental requests, approvals, and messages here.',
                                        style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                                  ],
                                ),
                              )
                            : RefreshIndicator(
                                onRefresh: _fetchNotifications,
                                color: AppColors.primary,
                                child: ListView.builder(
                                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                                  itemCount: _notifications.length,
                                  itemBuilder: (ctx, idx) {
                                    final n = _notifications[idx];
                                    final isRead = n['is_read'] == true;

                                    return Container(
                                      margin: const EdgeInsets.only(bottom: 10),
                                      child: GlassContainer(
                                        level: isRead ? GlassLevel.subtle : GlassLevel.standard,
                                        borderRadius: BorderRadius.circular(16),
                                        padding: const EdgeInsets.all(14),
                                        child: InkWell(
                                          onTap: () {
                                            if (!isRead) _markRead(n['id'], idx);
                                            final type = n['type'];
                                            if (type == 'rental' || type == 'rental_request') {
                                              context.push('/rentals');
                                            } else if (type == 'chat' || type == 'message') {
                                              context.push('/chat');
                                            }
                                          },
                                          child: Row(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Container(
                                                padding: const EdgeInsets.all(8),
                                                decoration: BoxDecoration(
                                                  color: isRead ? const Color(0x221E293B) : AppColors.primary.withOpacity(0.2),
                                                  shape: BoxShape.circle,
                                                ),
                                                child: Icon(
                                                  Icons.notifications_active_outlined,
                                                  size: 18,
                                                  color: isRead ? AppColors.textMuted : AppColors.accent,
                                                ),
                                              ),
                                              const SizedBox(width: 12),
                                              Expanded(
                                                child: Column(
                                                  crossAxisAlignment: CrossAxisAlignment.start,
                                                  children: [
                                                    Text(
                                                      n['title'] ?? 'Notification',
                                                      style: TextStyle(
                                                        fontSize: 14,
                                                        fontWeight: isRead ? FontWeight.w600 : FontWeight.w800,
                                                        color: AppColors.textPrimary,
                                                      ),
                                                    ),
                                                    const SizedBox(height: 4),
                                                    Text(
                                                      n['message'] ?? '',
                                                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                              if (!isRead)
                                                Container(
                                                  width: 8,
                                                  height: 8,
                                                  decoration: const BoxDecoration(
                                                    color: AppColors.accent,
                                                    shape: BoxShape.circle,
                                                  ),
                                                ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    );
                                  },
                                ),
                              ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
