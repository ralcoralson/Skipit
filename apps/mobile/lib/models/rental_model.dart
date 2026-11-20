import 'listing_model.dart';
import 'user_model.dart';

class RentalModel {
  final String id;
  final String listingId;
  final String ownerId;
  final String renterId;
  final String startDate;
  final String endDate;
  final int totalDays;
  final double totalPrice;
  final double securityDeposit;
  final String requestStatus; // 'pending', 'accepted', 'rejected', 'cancelled', 'completed'
  final String paymentStatus; // 'pending', 'paid_in_person'
  final String? notes;
  final String? responseNote;
  final String createdAt;
  final ListingModel? listing;
  final UserModel? owner;
  final UserModel? renter;

  RentalModel({
    required this.id,
    required this.listingId,
    required this.ownerId,
    required this.renterId,
    required this.startDate,
    required this.endDate,
    required this.totalDays,
    required this.totalPrice,
    this.securityDeposit = 0.0,
    required this.requestStatus,
    this.paymentStatus = 'pending',
    this.notes,
    this.responseNote,
    required this.createdAt,
    this.listing,
    this.owner,
    this.renter,
  });

  factory RentalModel.fromJson(Map<String, dynamic> json) {
    return RentalModel(
      id: json['id'] ?? '',
      listingId: json['listing_id'] ?? '',
      ownerId: json['owner_id'] ?? '',
      renterId: json['renter_id'] ?? '',
      startDate: json['start_date'] ?? '',
      endDate: json['end_date'] ?? '',
      totalDays: json['total_days'] ?? 1,
      totalPrice: (json['total_price'] != null) ? double.parse(json['total_price'].toString()) : 0.0,
      securityDeposit: (json['security_deposit'] != null) ? double.parse(json['security_deposit'].toString()) : 0.0,
      requestStatus: json['request_status'] ?? 'pending',
      paymentStatus: json['payment_status'] ?? 'pending',
      notes: json['notes'],
      responseNote: json['response_note'],
      createdAt: json['created_at'] ?? '',
      listing: json['listing'] != null ? ListingModel.fromJson(json['listing']) : null,
      owner: json['owner'] != null ? UserModel.fromJson(json['owner']) : null,
      renter: json['renter'] != null ? UserModel.fromJson(json['renter']) : null,
    );
  }
}
