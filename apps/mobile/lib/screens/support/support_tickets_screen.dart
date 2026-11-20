import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/ambient_background.dart';
import '../../widgets/glass_container.dart';

class SupportTicketsScreen extends ConsumerStatefulWidget {
  const SupportTicketsScreen({super.key});

  @override
  ConsumerState<SupportTicketsScreen> createState() => _SupportTicketsScreenState();
}

class _SupportTicketsScreenState extends ConsumerState<SupportTicketsScreen> {
  List<dynamic> _tickets = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchTickets();
  }

  Future<void> _fetchTickets() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final res = await apiClient.dio.get('/tickets');
      setState(() {
        _tickets = res.data['tickets'] as List? ?? [];
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
        _error = 'Failed to load support tickets: $e';
      });
    }
  }

  void _showCreateTicketDialog() {
    final subjectCtrl = TextEditingController();
    final messageCtrl = TextEditingController();
    String priority = 'medium';
    bool isSubmitting = false;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDlgState) => AlertDialog(
          backgroundColor: const Color(0xFA0A1128),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: const BorderSide(color: Color(0x4D38BDF8)),
          ),
          title: const Text('Create Support Ticket',
              style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w900)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              TextField(
                controller: subjectCtrl,
                style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
                decoration: const InputDecoration(
                  hintText: 'Subject (e.g. Issue with rental return)',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: messageCtrl,
                maxLines: 4,
                style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
                decoration: const InputDecoration(
                  hintText: 'Explain the issue with as much detail as possible...',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  const Text('Priority: ', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                  DropdownButton<String>(
                    value: priority,
                    dropdownColor: const Color(0xFF0F1E3D),
                    style: const TextStyle(color: AppColors.accent, fontSize: 12, fontWeight: FontWeight.bold),
                    items: const [
                      DropdownMenuItem(value: 'low', child: Text('Low')),
                      DropdownMenuItem(value: 'medium', child: Text('Medium')),
                      DropdownMenuItem(value: 'high', child: Text('High')),
                    ],
                    onChanged: (val) {
                      if (val != null) setDlgState(() => priority = val);
                    },
                  ),
                ],
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel', style: TextStyle(color: AppColors.textMuted)),
            ),
            ElevatedButton(
              onPressed: isSubmitting
                  ? null
                  : () async {
                      final subject = subjectCtrl.text.trim();
                      final message = messageCtrl.text.trim();
                      if (subject.isEmpty || message.isEmpty) return;

                      setDlgState(() => isSubmitting = true);
                      try {
                        await apiClient.dio.post('/tickets', data: {
                          'subject': subject,
                          'description': message,
                          'priority': priority,
                        });
                        Navigator.pop(ctx);
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            backgroundColor: Color(0xFF0F2454),
                            content: Text('Support ticket created successfully!',
                                style: TextStyle(color: AppColors.accent, fontWeight: FontWeight.bold)),
                          ),
                        );
                        _fetchTickets();
                      } catch (e) {
                        setDlgState(() => isSubmitting = false);
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(backgroundColor: Colors.redAccent, content: Text('Failed: $e')),
                        );
                      }
                    },
              child: isSubmitting
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Text('Submit Ticket'),
            ),
          ],
        ),
      ),
    );
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'resolved':
        return const Color(0xFF10B981);
      case 'in_progress':
        return const Color(0xFF38BDF8);
      case 'closed':
        return const Color(0xFF6B7280);
      case 'open':
      default:
        return const Color(0xFFF59E0B);
    }
  }

  @override
  Widget build(BuildContext context) {
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
                          'Support Tickets',
                          style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: AppColors.textPrimary),
                        ),
                      ],
                    ),
                    IconButton(
                      icon: const Icon(Icons.add_circle_outline_rounded, color: AppColors.accent, size: 26),
                      onPressed: _showCreateTicketDialog,
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
                                ElevatedButton(onPressed: _fetchTickets, child: const Text('Retry')),
                              ],
                            ),
                          )
                        : _tickets.isEmpty
                            ? Center(
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(Icons.headset_mic_outlined, size: 56, color: AppColors.textMuted.withOpacity(0.4)),
                                    const SizedBox(height: 14),
                                    const Text('No support tickets',
                                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
                                    const SizedBox(height: 6),
                                    const Text('Need help? Tap the + button above to open a ticket.',
                                        style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                                  ],
                                ),
                              )
                            : RefreshIndicator(
                                onRefresh: _fetchTickets,
                                color: AppColors.primary,
                                child: ListView.builder(
                                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                                  itemCount: _tickets.length,
                                  itemBuilder: (ctx, idx) {
                                    final t = _tickets[idx];
                                    final status = t['status'] ?? 'open';
                                    final statusColor = _getStatusColor(status);

                                    return Container(
                                      margin: const EdgeInsets.only(bottom: 12),
                                      child: GlassContainer(
                                        level: GlassLevel.subtle,
                                        borderRadius: BorderRadius.circular(16),
                                        padding: const EdgeInsets.all(16),
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Row(
                                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                              children: [
                                                Expanded(
                                                  child: Text(
                                                    t['subject'] ?? 'Support Inquiry',
                                                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
                                                  ),
                                                ),
                                                Container(
                                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                                  decoration: BoxDecoration(
                                                    color: statusColor.withOpacity(0.18),
                                                    borderRadius: BorderRadius.circular(10),
                                                    border: Border.all(color: statusColor.withOpacity(0.5)),
                                                  ),
                                                  child: Text(
                                                    status.toUpperCase(),
                                                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: statusColor),
                                                  ),
                                                ),
                                              ],
                                            ),
                                            const SizedBox(height: 8),
                                            Text(
                                              t['description'] ?? '',
                                              style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                                            ),
                                            if (t['admin_notes'] != null && (t['admin_notes'] as String).isNotEmpty) ...[
                                              const SizedBox(height: 10),
                                              Container(
                                                padding: const EdgeInsets.all(10),
                                                decoration: BoxDecoration(
                                                  color: const Color(0x330044FF),
                                                  borderRadius: BorderRadius.circular(10),
                                                ),
                                                child: Row(
                                                  crossAxisAlignment: CrossAxisAlignment.start,
                                                  children: [
                                                    const Icon(Icons.admin_panel_settings_outlined, size: 16, color: AppColors.accent),
                                                    const SizedBox(width: 8),
                                                    Expanded(
                                                      child: Text(
                                                        'Response: ${t['admin_notes']}',
                                                        style: const TextStyle(fontSize: 11, color: AppColors.accent),
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                            ],
                                          ],
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
