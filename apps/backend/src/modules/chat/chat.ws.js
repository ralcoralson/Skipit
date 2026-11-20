const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const config = require('../../config/env');
const { supabaseAdmin } = require('../../config/supabase');
const { notifyUser } = require('../notifications/fcm.service');

const activeUsers = new Map(); // userId -> Set<WebSocket>

const initWebSocketServer = (server) => {
  const wss = new WebSocketServer({ server });

  console.log('[WebSocket Engine] Real-time chat server initialized');

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.userId = null;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', async (raw) => {
      try {
        const payload = JSON.parse(raw.toString());
        const { type } = payload;

        switch (type) {
          // 1. Client Authentication & Connection Binding (STRICT JWT VERIFICATION)
          case 'auth': {
            const { token } = payload;

            if (!token) {
              ws.send(JSON.stringify({ type: 'auth_error', error: 'Authentication token is required' }));
              return ws.close(4001, 'Unauthorized: Missing Token');
            }

            let verifiedUserId = null;

            try {
              const decoded = jwt.verify(token, config.jwtSecret);
              verifiedUserId = decoded.id || decoded.sub;
            } catch (jwtErr) {
              // Fallback to verify with Supabase Auth
              try {
                const { data: { user } } = await supabaseAdmin.auth.getUser(token);
                if (user) verifiedUserId = user.id;
              } catch (sbErr) {
                // Verification failed
              }
            }

            if (verifiedUserId) {
              ws.userId = verifiedUserId;
              if (!activeUsers.has(verifiedUserId)) {
                activeUsers.set(verifiedUserId, new Set());
              }
              activeUsers.get(verifiedUserId).add(ws);

              ws.send(JSON.stringify({
                type: 'auth_success',
                userId: verifiedUserId,
                message: 'WebSocket authenticated successfully',
              }));

              console.log(`[WS] User ${verifiedUserId} authenticated and connected (Active users: ${activeUsers.size})`);
            } else {
              ws.send(JSON.stringify({ type: 'auth_error', error: 'Invalid or expired authentication token' }));
              ws.close(4001, 'Unauthorized: Invalid Token');
            }
            break;
          }

          // 2. Real-time Message Send (Phase 1.10: Rate limit, block check, receiver check, 2000 cap)
          case 'send_message': {
            if (!ws.userId) {
              return ws.send(JSON.stringify({ type: 'error', error: 'Not authenticated on WebSocket' }));
            }

            // Per-connection WebSocket rate limiter (max 20 messages per 10 seconds)
            const now = Date.now();
            ws.messageTimestamps = (ws.messageTimestamps || []).filter((ts) => now - ts < 10000);
            if (ws.messageTimestamps.length >= 20) {
              return ws.send(JSON.stringify({
                type: 'error',
                error: 'Rate limit exceeded: Maximum 20 messages per 10 seconds allowed.',
              }));
            }
            ws.messageTimestamps.push(now);

            const { receiver_id, content, listing_id, rental_request_id } = payload;
            if (!receiver_id || !content) {
              return ws.send(JSON.stringify({ type: 'error', error: 'Missing receiver_id or content' }));
            }

            if (receiver_id === ws.userId) {
              return ws.send(JSON.stringify({ type: 'error', error: 'Cannot send messages to yourself' }));
            }

            const cleanContent = String(content).trim();
            if (cleanContent.length > 2000) {
              return ws.send(JSON.stringify({
                type: 'error',
                error: 'Message content cannot exceed 2000 characters',
              }));
            }

            // Verify receiver exists
            const { data: receiverProfile } = await supabaseAdmin
              .from('profiles')
              .select('id')
              .eq('id', receiver_id)
              .maybeSingle();

            if (!receiverProfile) {
              return ws.send(JSON.stringify({ type: 'error', error: 'Recipient user does not exist' }));
            }

            // Check user_blocks table
            const { data: block } = await supabaseAdmin
              .from('user_blocks')
              .select('id')
              .or(`and(blocker_id.eq.${ws.userId},blocked_id.eq.${receiver_id}),and(blocker_id.eq.${receiver_id},blocked_id.eq.${ws.userId})`)
              .maybeSingle();

            if (block) {
              return ws.send(JSON.stringify({ type: 'error', error: 'Communication with this user is blocked' }));
            }

            // Save to database
            const messageData = {
              sender_id: ws.userId,
              receiver_id,
              content: cleanContent,
              booking_id: listing_id || null,
              rental_request_id: rental_request_id || null,
              message_type: 'text',
              is_read: false,
              created_at: new Date().toISOString(),
            };

            const { data: savedMsg, error: dbErr } = await supabaseAdmin
              .from('messages')
              .insert([messageData])
              .select()
              .single();

            if (dbErr) {
              return ws.send(JSON.stringify({ type: 'error', error: dbErr.message }));
            }

            // Ack to sender
            ws.send(JSON.stringify({
              type: 'message_sent',
              message: savedMsg,
            }));

            // Push to receiver if online
            if (activeUsers.has(receiver_id)) {
              const recipientSockets = activeUsers.get(receiver_id);
              const eventPayload = JSON.stringify({
                type: 'message_received',
                message: savedMsg,
              });

              for (const socket of recipientSockets) {
                if (socket.readyState === socket.OPEN) {
                  socket.send(eventPayload);
                }
              }
            }

            // Trigger in-app & FCM push notification to recipient
            notifyUser(receiver_id, {
              title: 'New Rental Chat Message',
              body: cleanContent.length > 60 ? `${cleanContent.substring(0, 60)}...` : cleanContent,
              data: { sender_id: ws.userId, listing_id, type: 'message' },
            }).catch((err) => console.warn('[WS Notification Dispatch Error]:', err.message));

            break;
          }

          // 3. Typing Indicator
          case 'typing': {
            if (!ws.userId) return;
            const { receiver_id, is_typing } = payload;
            if (activeUsers.has(receiver_id)) {
              const payloadStr = JSON.stringify({
                type: 'user_typing',
                sender_id: ws.userId,
                is_typing: Boolean(is_typing),
              });
              for (const socket of activeUsers.get(receiver_id)) {
                if (socket.readyState === socket.OPEN) {
                  socket.send(payloadStr);
                }
              }
            }
            break;
          }

          // 4. Read Receipt Notification
          case 'read_receipt': {
            if (!ws.userId) return;
            const { sender_id } = payload;
            // Mark read in DB
            await supabaseAdmin
              .from('messages')
              .update({ is_read: true })
              .eq('sender_id', sender_id)
              .eq('receiver_id', ws.userId)
              .eq('is_read', false);

            // Notify original sender
            if (activeUsers.has(sender_id)) {
              const payloadStr = JSON.stringify({
                type: 'messages_read',
                reader_id: ws.userId,
              });
              for (const socket of activeUsers.get(sender_id)) {
                if (socket.readyState === socket.OPEN) {
                  socket.send(payloadStr);
                }
              }
            }
            break;
          }

          // 5. Presence / Online Status Check
          case 'presence_check': {
            const { user_ids = [] } = payload;
            const statuses = {};
            for (const uid of user_ids) {
              statuses[uid] = activeUsers.has(uid) && activeUsers.get(uid).size > 0;
            }
            ws.send(JSON.stringify({ type: 'presence_result', statuses }));
            break;
          }

          default:
            ws.send(JSON.stringify({ type: 'unknown_event', received: type }));
        }
      } catch (err) {
        console.error('[WS Message Handler Error]:', err.message);
        ws.send(JSON.stringify({ type: 'error', error: 'Malformed WebSocket payload' }));
      }
    });

    ws.on('close', () => {
      if (ws.userId && activeUsers.has(ws.userId)) {
        const userSet = activeUsers.get(ws.userId);
        userSet.delete(ws);
        if (userSet.size === 0) {
          activeUsers.delete(ws.userId);
        }
        console.log(`[WS] User ${ws.userId} disconnected (Remaining active: ${activeUsers.size})`);
      }
    });
  });

  // Heartbeat to sweep dead sockets every 30 seconds
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(interval));

  return wss;
};

module.exports = {
  initWebSocketServer,
  activeUsers,
};
