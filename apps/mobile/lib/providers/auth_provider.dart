import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/network/api_client.dart';
import '../core/network/fcm_service.dart';
import '../models/user_model.dart';

class AuthState {
  final UserModel? user;
  final String? token;
  final bool isLoading;
  final String? error;

  AuthState({
    this.user,
    this.token,
    this.isLoading = false,
    this.error,
  });

  bool get isAuthenticated => token != null && user != null;

  AuthState copyWith({
    UserModel? user,
    String? token,
    bool? isLoading,
    String? error,
  }) {
    return AuthState(
      user: user ?? this.user,
      token: token ?? this.token,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier() : super(AuthState(isLoading: true)) {
    loadStoredSession();
  }

  Future<void> loadStoredSession() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('skipit_token');
      final userJson = prefs.getString('skipit_user');

      if (token != null && userJson != null) {
        final user = UserModel.fromJson(jsonDecode(userJson));
        state = AuthState(token: token, user: user, isLoading: false);

        // Background profile refresh
        apiClient.dio.get('/auth/me').then((res) {
          if (res.data['user'] != null) {
            final refreshed = UserModel.fromJson(res.data['user']);
            prefs.setString('skipit_user', jsonEncode(refreshed.toJson()));
            state = state.copyWith(user: refreshed);
          }
        }).catchError((_) {});

        // Ensure FCM token is registered
        FcmService.registerDeviceToken();
      } else {
        state = AuthState(isLoading: false);
      }
    } catch (e) {
      state = AuthState(isLoading: false);
    }
  }

  Future<bool> signInWithGoogleToken(String idToken) async {
    try {
      state = state.copyWith(isLoading: true, error: null);
      final res = await apiClient.dio.post('/auth/google', data: {
        'credential': idToken,
        'id_token': idToken,
      });

      final token = res.data['token'];
      final user = UserModel.fromJson(res.data['user']);

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('skipit_token', token);
      await prefs.setString('skipit_user', jsonEncode(user.toJson()));

      state = AuthState(token: token, user: user, isLoading: false);
      FcmService.registerDeviceToken();
      return true;
    } on DioException catch (e) {
      String errorMsg = 'Google Sign-In failed';
      if (e.response?.data is Map) {
        errorMsg = e.response?.data['error'] ?? e.response?.data['message'] ?? 'Google Sign-In failed';
      } else if (e.message != null && e.message!.isNotEmpty) {
        errorMsg = e.message!;
      }
      state = state.copyWith(isLoading: false, error: errorMsg);
      return false;
    }
  }

  Future<bool> register(String email, String password, {String? fullName}) async {
    try {
      state = state.copyWith(isLoading: true, error: null);
      final res = await apiClient.dio.post('/auth/register', data: {
        'email': email,
        'password': password,
        'full_name': fullName,
      });

      final token = res.data['token'];
      final user = UserModel.fromJson(res.data['user']);

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('skipit_token', token);
      await prefs.setString('skipit_user', jsonEncode(user.toJson()));

      state = AuthState(token: token, user: user, isLoading: false);
      FcmService.registerDeviceToken();
      return true;
    } on DioException catch (e) {
      String errorMsg = 'Registration failed';
      if (e.response?.data is Map) {
        errorMsg = e.response?.data['error'] ?? e.response?.data['message'] ?? 'Registration failed';
      } else if (e.message != null && e.message!.isNotEmpty) {
        errorMsg = e.message!;
      }
      state = state.copyWith(isLoading: false, error: errorMsg);
      return false;
    }
  }

  Future<bool> sendOtp(String phone) async {
    try {
      state = state.copyWith(isLoading: true, error: null);
      await apiClient.dio.post('/auth/otp/send', data: {'phone': phone});
      state = state.copyWith(isLoading: false);
      return true;
    } on DioException catch (e) {
      state = state.copyWith(isLoading: false, error: e.response?.data['error'] ?? 'Failed to send OTP');
      return false;
    }
  }

  Future<bool> verifyOtp(String phone, String otp, {String? fullName}) async {
    try {
      state = state.copyWith(isLoading: true, error: null);
      final res = await apiClient.dio.post('/auth/otp/verify', data: {
        'phone': phone,
        'otp': otp,
        'full_name': fullName,
      });

      final token = res.data['token'];
      final user = UserModel.fromJson(res.data['user']);

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('skipit_token', token);
      await prefs.setString('skipit_user', jsonEncode(user.toJson()));

      state = AuthState(token: token, user: user, isLoading: false);
      FcmService.registerDeviceToken();
      return true;
    } on DioException catch (e) {
      state = state.copyWith(isLoading: false, error: e.response?.data['error'] ?? 'Invalid OTP code');
      return false;
    }
  }

  Future<bool> login(String email, String password) async {
    try {
      state = state.copyWith(isLoading: true, error: null);
      final res = await apiClient.dio.post('/auth/login', data: {
        'email': email,
        'password': password,
      });

      final token = res.data['token'];
      final user = UserModel.fromJson(res.data['user']);

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('skipit_token', token);
      await prefs.setString('skipit_user', jsonEncode(user.toJson()));

      state = AuthState(token: token, user: user, isLoading: false);
      FcmService.registerDeviceToken();
      return true;
    } on DioException catch (e) {
      state = state.copyWith(isLoading: false, error: e.response?.data['error'] ?? 'Login failed');
      return false;
    }
  }

  Future<bool> updateProfile({String? fullName, String? bio, String? location, String? avatarUrl}) async {
    try {
      state = state.copyWith(isLoading: true, error: null);
      final body = <String, dynamic>{};
      if (fullName != null) body['full_name'] = fullName;
      if (bio != null) body['bio'] = bio;
      if (location != null) body['location'] = location;
      if (avatarUrl != null) body['avatar_url'] = avatarUrl;

      final res = await apiClient.dio.patch('/auth/profile', data: body);
      if (res.data['user'] != null) {
        final updated = UserModel.fromJson(res.data['user']);
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('skipit_user', jsonEncode(updated.toJson()));
        state = state.copyWith(user: updated, isLoading: false);
        return true;
      }
      state = state.copyWith(isLoading: false);
      return true;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: 'Failed to update profile');
      return false;
    }
  }

  Future<bool> deleteAccount() async {
    try {
      state = state.copyWith(isLoading: true, error: null);
      await apiClient.dio.delete('/auth/account');
      await logout();
      return true;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: 'Failed to delete account');
      return false;
    }
  }

  Future<void> logout() async {
    await FcmService.unregisterDeviceToken();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('skipit_token');
    await prefs.remove('skipit_user');
    state = AuthState();
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier();
});
