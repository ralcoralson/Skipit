import 'user_model.dart';

class ListingModel {
  final String id;
  final String ownerId;
  final String title;
  final String description;
  final double pricePerDay;
  final double? pricePerWeek;
  final double? pricePerMonth;
  final double depositAmount;
  final String category;
  final String condition;
  final List<String> images;
  final String locationName;
  final bool isAvailable;
  final bool isActive;
  final int viewsCount;
  final UserModel? owner;
  final bool isWishlisted;
  final int minRentalDays;
  final int maxRentalDays;

  ListingModel({
    required this.id,
    required this.ownerId,
    required this.title,
    required this.description,
    required this.pricePerDay,
    this.pricePerWeek,
    this.pricePerMonth,
    this.depositAmount = 0.0,
    required this.category,
    this.condition = 'good',
    required this.images,
    required this.locationName,
    this.isAvailable = true,
    this.isActive = true,
    this.viewsCount = 0,
    this.owner,
    this.isWishlisted = false,
    this.minRentalDays = 1,
    this.maxRentalDays = 30,
  });

  factory ListingModel.fromJson(Map<String, dynamic> json) {
    List<String> parsedImages = [];
    if (json['images'] != null) {
      if (json['images'] is List) {
        parsedImages = (json['images'] as List).map((e) => e.toString()).toList();
      } else if (json['images'] is String) {
        parsedImages = [json['images']];
      }
    }
    if (parsedImages.isEmpty) {
      parsedImages = ['https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=600&q=80'];
    }

    return ListingModel(
      id: json['id'] ?? '',
      ownerId: json['owner_id'] ?? '',
      title: json['title'] ?? '',
      description: json['description'] ?? '',
      pricePerDay: (json['price_per_day'] != null) ? double.parse(json['price_per_day'].toString()) : 0.0,
      pricePerWeek: (json['price_per_week'] != null) ? double.parse(json['price_per_week'].toString()) : null,
      pricePerMonth: (json['price_per_month'] != null) ? double.parse(json['price_per_month'].toString()) : null,
      depositAmount: (json['deposit_amount'] != null) ? double.parse(json['deposit_amount'].toString()) : 0.0,
      category: json['category'] ?? 'Other',
      condition: json['condition'] ?? 'good',
      images: parsedImages,
      locationName: json['location_name'] ?? 'Bengaluru, India',
      isAvailable: json['is_available'] ?? true,
      isActive: json['is_active'] ?? true,
      viewsCount: json['views_count'] ?? 0,
      owner: json['owner'] != null ? UserModel.fromJson(json['owner']) : null,
      isWishlisted: json['is_wishlisted'] ?? false,
      minRentalDays: json['min_rental_days'] ?? 1,
      maxRentalDays: json['max_rental_days'] ?? 30,
    );
  }
}
