import 'package:flutter/foundation.dart';

class AppConfig {
  static const String appName = 'SkipIt';
  static const String tagline = 'Skip Buying. Rent Smarter.';

  static String get apiBaseUrl {
    const fromEnv = String.fromEnvironment('API_BASE_URL');
    if (fromEnv.isNotEmpty) return fromEnv;
    if (kReleaseMode) {
      throw StateError(
        'FATAL: API_BASE_URL must be specified via --dart-define in release builds. '
        'Localhost is strictly prohibited in release mode.',
      );
    }
    return 'http://localhost:5000/api/v1';
  }

  static String get wsUrl {
    const fromEnv = String.fromEnvironment('WS_URL');
    if (fromEnv.isNotEmpty) return fromEnv;
    if (kReleaseMode) {
      throw StateError(
        'FATAL: WS_URL must be specified via --dart-define in release builds. '
        'Localhost is strictly prohibited in release mode.',
      );
    }
    return 'ws://localhost:5000';
  }

  static const Duration connectTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 15);
}
