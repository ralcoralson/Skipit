import 'dart:io';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:go_router/go_router.dart';
import 'api_client.dart';

class FcmService {
  static String? _currentToken;
  static bool _initialized = false;

  static Future<void> initialize(GoRouter router) async {
    if (_initialized) return;
    try {
      if (Firebase.apps.isEmpty) {
        debugPrint('[FCM] Firebase not initialized. Skipping push service setup.');
        return;
      }

      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );

      // Handle token refresh
      messaging.onTokenRefresh.listen((newToken) {
        _currentToken = newToken;
        registerDeviceToken(newToken);
      });

      // Handle notification taps when app is in background or terminated
      FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
        _handleNotificationNavigation(message.data, router);
      });

      final initialMessage = await messaging.getInitialMessage();
      if (initialMessage != null) {
        _handleNotificationNavigation(initialMessage.data, router);
      }

      _initialized = true;
    } catch (e) {
      debugPrint('[FCM Setup Error]: $e');
    }
  }

  static void _handleNotificationNavigation(Map<String, dynamic> data, GoRouter router) {
    debugPrint('[FCM Notification Tap Data]: $data');
    if (data.containsKey('rental_id')) {
      router.push('/rentals');
    } else if (data.containsKey('peer_id')) {
      router.push('/chat/${data['peer_id']}');
    } else if (data.containsKey('sender_id')) {
      router.push('/chat/${data['sender_id']}');
    } else {
      router.push('/notifications');
    }
  }

  static Future<void> registerDeviceToken([String? token]) async {
    try {
      if (Firebase.apps.isEmpty) return;
      final fcmToken = token ?? await FirebaseMessaging.instance.getToken();
      if (fcmToken == null || fcmToken.isEmpty) return;

      _currentToken = fcmToken;
      final platform = kIsWeb ? 'web' : (Platform.isAndroid ? 'android' : 'ios');

      await apiClient.dio.post('/notifications/device', data: {
        'token': fcmToken,
        'platform': platform,
      });
      debugPrint('[FCM Token Registered Successfully]: $platform');
    } catch (e) {
      debugPrint('[FCM Token Register Warning]: $e');
    }
  }

  static Future<void> unregisterDeviceToken() async {
    try {
      if (_currentToken != null) {
        await apiClient.dio.delete('/notifications/device', data: {
          'token': _currentToken,
        });
        debugPrint('[FCM Token Unregistered Successfully]');
        _currentToken = null;
      }
    } catch (e) {
      debugPrint('[FCM Token Unregister Warning]: $e');
    }
  }
}
