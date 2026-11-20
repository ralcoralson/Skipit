import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_colors.dart';
import '../../providers/auth_provider.dart';
import '../../providers/chat_provider.dart';
import '../../widgets/ambient_background.dart';
import '../../widgets/glass_container.dart';

class ConversationsScreen extends ConsumerStatefulWidget {
  const ConversationsScreen({super.key});

  @override
  ConsumerState<ConversationsScreen> createState() => _ConversationsScreenState();
}

class _ConversationsScreenState extends ConsumerState<ConversationsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(chatProvider.notifier).fetchConversations();
    });
  }

  @override
  Widget build(BuildContext context) {
    final chatState = ref.watch(chatProvider);
    final authState = ref.watch(authProvider);

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
                border: Border(bottom: BorderSide(color: Color(0x2B38BDF8), width: 1)),
              ),
              child: Row(
                children: const [
                  Text(
                    'Direct Messages',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                      color: AppColors.textPrimary,
                      letterSpacing: -0.3,
                    ),
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
                        decoration: BoxDecoration(
                          color: AppColors.light,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.chat_bubble_outline_rounded, size: 28, color: AppColors.primary),
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        'Direct Rental Negotiation',
                        style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: AppColors.textPrimary),
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'Sign in to discuss pricing, duration, deposit, and arrange pickup directly with equipment owners.',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.4),
                      ),
                      const SizedBox(height: 20),
                      ElevatedButton(
                        onPressed: () => context.push('/auth'),
                        child: const Text('Sign In to Continue'),
                      ),
                    ],
                  ),
                ),
              )
            : RefreshIndicator(
                color: AppColors.primary,
                onRefresh: () => ref.read(chatProvider.notifier).fetchConversations(),
                child: chatState.isLoading
                    ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                    : chatState.conversations.isEmpty
                        ? Center(
                            child: GlassContainer(
                              level: GlassLevel.standard,
                              padding: const EdgeInsets.all(24),
                              margin: const EdgeInsets.symmetric(horizontal: 24),
                              borderRadius: BorderRadius.circular(20),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: const [
                                  Icon(Icons.mark_chat_unread_outlined, size: 44, color: AppColors.primary),
                                  SizedBox(height: 12),
                                  Text(
                                    'No conversations yet',
                                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: AppColors.textPrimary),
                                  ),
                                  SizedBox(height: 4),
                                  Text(
                                    'Inquire on any rental item to start chatting directly with owners!',
                                    textAlign: TextAlign.center,
                                    style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                                  ),
                                ],
                              ),
                            ),
                          )
                        : ListView.separated(
                            padding: EdgeInsets.only(
                              top: MediaQuery.of(context).padding.top + 76,
                              bottom: 96,
                              left: 16,
                              right: 16,
                            ),
                            itemCount: chatState.conversations.length,
                            separatorBuilder: (_, __) => const SizedBox(height: 10),
                            itemBuilder: (context, index) {
                              final conv = chatState.conversations[index];
                              return GlassContainer(
                                level: GlassLevel.standard,
                                borderRadius: BorderRadius.circular(18),
                                padding: const EdgeInsets.all(12),
                                onTap: () {
                                  context.push('/chat/${conv.peer.id}', extra: conv);
                                },
                                child: Row(
                                  children: [
                                    Container(
                                      width: 46,
                                      height: 46,
                                      decoration: BoxDecoration(
                                        gradient: const LinearGradient(
                                          colors: [AppColors.primary, AppColors.accent],
                                        ),
                                        shape: BoxShape.circle,
                                      ),
                                      alignment: Alignment.center,
                                      child: Text(
                                        conv.peer.fullName.characters.first,
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w900,
                                          color: Colors.white,
                                          fontSize: 16,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            children: [
                                              Text(
                                                conv.peer.fullName,
                                                style: const TextStyle(
                                                  fontWeight: FontWeight.w800,
                                                  fontSize: 14,
                                                  color: AppColors.textPrimary,
                                                ),
                                              ),
                                              if (conv.peer.isVerified) ...[
                                                const SizedBox(width: 4),
                                                const Icon(Icons.verified_rounded, size: 14, color: AppColors.primary),
                                              ],
                                            ],
                                          ),
                                          if (conv.listing != null) ...[
                                            const SizedBox(height: 2),
                                            Text(
                                              'Re: ${conv.listing!.title}',
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                              style: const TextStyle(
                                                fontSize: 11,
                                                fontWeight: FontWeight.w700,
                                                color: AppColors.primary,
                                              ),
                                            ),
                                          ],
                                          const SizedBox(height: 2),
                                          Text(
                                            conv.lastMessage?.content ?? 'No message yet',
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(
                                              fontSize: 12,
                                              color: AppColors.textSecondary,
                                              fontWeight: FontWeight.w500,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    if (conv.unreadCount > 0)
                                      Container(
                                        padding: const EdgeInsets.all(7),
                                        decoration: const BoxDecoration(
                                          color: AppColors.primary,
                                          shape: BoxShape.circle,
                                        ),
                                        child: Text(
                                          conv.unreadCount.toString(),
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 10,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ),
                                  ],
                                ),
                              );
                            },
                          ),
              ),
      ),
    );
  }
}
