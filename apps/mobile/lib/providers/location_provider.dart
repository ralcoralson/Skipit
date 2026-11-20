import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/config/app_config.dart';

class LocationState {
  final String selectedCity;
  final String formattedLocation;
  final bool isDetecting;
  final bool isAutoDetected;
  final String? error;

  const LocationState({
    required this.selectedCity,
    required this.formattedLocation,
    this.isDetecting = false,
    this.isAutoDetected = false,
    this.error,
  });

  LocationState copyWith({
    String? selectedCity,
    String? formattedLocation,
    bool? isDetecting,
    bool? isAutoDetected,
    String? error,
  }) {
    return LocationState(
      selectedCity: selectedCity ?? this.selectedCity,
      formattedLocation: formattedLocation ?? this.formattedLocation,
      isDetecting: isDetecting ?? this.isDetecting,
      isAutoDetected: isAutoDetected ?? this.isAutoDetected,
      error: error,
    );
  }
}

class LocationNotifier extends StateNotifier<LocationState> {
  LocationNotifier()
      : super(const LocationState(
          selectedCity: 'Delhi NCR',
          formattedLocation: 'Delhi NCR, India',
        )) {
    loadSavedOrDetect();
  }

  static const String _prefKey = 'skipit_user_location';

  Future<void> loadSavedOrDetect() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final saved = prefs.getString(_prefKey);
      if (saved != null && saved.isNotEmpty) {
        state = state.copyWith(
          selectedCity: saved,
          formattedLocation: saved.contains('India') ? saved : '$saved, India',
        );
        return;
      }
    } catch (_) {}

    // Auto-detect on first launch
    await autoDetectLocation();
  }

  Future<bool> autoDetectLocation() async {
    state = state.copyWith(isDetecting: true, error: null);
    try {
      final dio = Dio(BaseOptions(
        connectTimeout: const Duration(seconds: 4),
        receiveTimeout: const Duration(seconds: 4),
      ));

      final res = await dio.get('${AppConfig.apiBaseUrl}/geo/ip');
      if (res.statusCode == 200 && res.data != null) {
        final city = res.data['city']?.toString() ?? '';
        final region = res.data['regionName']?.toString() ?? '';
        final country = res.data['country']?.toString() ?? 'India';

        String displayCity = city.isNotEmpty ? city : region;
        if (displayCity.isEmpty) displayCity = 'Delhi NCR';

        // Friendly mapping for NCR / Gurgaon / Sohna
        if (displayCity.toLowerCase() == 'sohna' ||
            displayCity.toLowerCase() == 'gurugram' ||
            displayCity.toLowerCase() == 'gurgaon') {
          displayCity = 'Gurgaon, NCR';
        }

        final formatted = region.isNotEmpty ? '$displayCity, $region' : '$displayCity, $country';

        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(_prefKey, displayCity);

        state = state.copyWith(
          selectedCity: displayCity,
          formattedLocation: formatted,
          isDetecting: false,
          isAutoDetected: true,
        );
        return true;
      }
    } catch (e) {
      // Graceful fallback
    }

    state = state.copyWith(isDetecting: false);
    return false;
  }

  Future<void> selectLocation(String city, {String? subtitle}) async {
    final formatted = subtitle != null && subtitle.isNotEmpty ? '$city, $subtitle' : '$city, India';
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_prefKey, city);
    } catch (_) {}

    state = state.copyWith(
      selectedCity: city,
      formattedLocation: formatted,
      isAutoDetected: false,
    );
  }
}

final locationProvider = StateNotifierProvider<LocationNotifier, LocationState>((ref) {
  return LocationNotifier();
});
