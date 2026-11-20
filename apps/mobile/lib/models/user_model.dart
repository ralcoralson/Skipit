class UserModel {
  final String id;
  final String fullName;
  final String? email;
  final String? phone;
  final String? avatarUrl;
  final String? bio;
  final String? location;
  final String role;
  final double rating;
  final int trustScore;
  final bool isVerified;
  final String kycStatus;
  final int totalRentals;
  final int totalListings;

  String? get phoneNumber => phone;

  UserModel({
    required this.id,
    required this.fullName,
    this.email,
    this.phone,
    this.avatarUrl,
    this.bio,
    this.location,
    this.role = 'user',
    this.rating = 5.0,
    this.trustScore = 50,
    this.isVerified = false,
    this.kycStatus = 'unverified',
    this.totalRentals = 0,
    this.totalListings = 0,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] ?? '',
      fullName: json['full_name'] ?? 'SkipIt Member',
      email: json['email'],
      phone: json['phone'] ?? json['phone_number'],
      avatarUrl: json['avatar_url'],
      bio: json['bio'],
      location: json['location'] ?? 'Bengaluru, India',
      role: json['role'] ?? 'user',
      rating: (json['rating'] != null) ? double.parse(json['rating'].toString()) : 5.0,
      trustScore: json['trust_score'] ?? 50,
      isVerified: json['is_verified'] ?? false,
      kycStatus: json['kyc_status'] ?? 'unverified',
      totalRentals: json['total_rentals'] ?? 0,
      totalListings: json['total_listings'] ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'full_name': fullName,
    'email': email,
    'phone': phone,
    'avatar_url': avatarUrl,
    'bio': bio,
    'location': location,
    'role': role,
    'rating': rating,
    'trust_score': trustScore,
    'is_verified': isVerified,
    'kyc_status': kycStatus,
  };
}
