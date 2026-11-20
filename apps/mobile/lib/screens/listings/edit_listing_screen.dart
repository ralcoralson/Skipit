import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../models/listing_model.dart';
import '../../widgets/ambient_background.dart';
import '../../widgets/glass_container.dart';

class EditListingScreen extends ConsumerStatefulWidget {
  final String listingId;
  final ListingModel? initialListing;

  const EditListingScreen({
    super.key,
    required this.listingId,
    this.initialListing,
  });

  @override
  ConsumerState<EditListingScreen> createState() => _EditListingScreenState();
}

class _EditListingScreenState extends ConsumerState<EditListingScreen> {
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _priceCtrl = TextEditingController();
  final _depositCtrl = TextEditingController();
  final _locationCtrl = TextEditingController();
  final _minDaysCtrl = TextEditingController();
  final _maxDaysCtrl = TextEditingController();

  final _picker = ImagePicker();
  List<String> _images = [];
  bool _isLoading = true;
  bool _isSaving = false;
  bool _requiresDeposit = false;

  @override
  void initState() {
    super.initState();
    if (widget.initialListing != null) {
      _populate(widget.initialListing!);
    } else {
      _fetchListing();
    }
  }

  void _populate(ListingModel l) {
    _titleCtrl.text = l.title;
    _descCtrl.text = l.description;
    _priceCtrl.text = l.pricePerDay.toInt().toString();
    _depositCtrl.text = l.depositAmount.toInt().toString();
    _locationCtrl.text = l.locationName;
    _minDaysCtrl.text = l.minRentalDays.toString();
    _maxDaysCtrl.text = l.maxRentalDays.toString();
    _requiresDeposit = l.depositAmount > 0;
    _images = List.from(l.images);
    _isLoading = false;
  }

  Future<void> _fetchListing() async {
    try {
      final res = await apiClient.dio.get('/listings/${widget.listingId}');
      final listing = ListingModel.fromJson(res.data['listing']);
      setState(() => _populate(listing));
    } catch (_) {
      setState(() => _isLoading = false);
    }
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    _priceCtrl.dispose();
    _depositCtrl.dispose();
    _locationCtrl.dispose();
    _minDaysCtrl.dispose();
    _maxDaysCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickImage() async {
    final picked = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (picked == null) return;

    try {
      final formData = FormData.fromMap({
        'image': await MultipartFile.fromFile(picked.path, filename: picked.name),
      });
      final res = await apiClient.dio.post('/listings/upload-image', data: formData);
      if (res.data['image_url'] != null) {
        setState(() => _images.add(res.data['image_url']));
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(backgroundColor: Colors.redAccent, content: Text('Image upload failed: $e')),
      );
    }
  }

  Future<void> _saveListing() async {
    setState(() => _isSaving = true);
    try {
      final payload = {
        'title': _titleCtrl.text.trim(),
        'description': _descCtrl.text.trim(),
        'price_per_day': double.tryParse(_priceCtrl.text.trim()) ?? 100.0,
        'deposit_amount': _requiresDeposit ? (double.tryParse(_depositCtrl.text.trim()) ?? 0.0) : 0.0,
        'location_name': _locationCtrl.text.trim(),
        'min_rental_days': int.tryParse(_minDaysCtrl.text.trim()) ?? 1,
        'max_rental_days': int.tryParse(_maxDaysCtrl.text.trim()) ?? 30,
      };

      await apiClient.dio.patch('/listings/${widget.listingId}', data: payload);
      setState(() => _isSaving = false);

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: Color(0xFF0F2454),
          content: Text('Listing updated successfully!', style: TextStyle(color: AppColors.accent, fontWeight: FontWeight.bold)),
        ),
      );
      context.pop();
    } catch (e) {
      setState(() => _isSaving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(backgroundColor: Colors.redAccent, content: Text('Update failed: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        backgroundColor: AppColors.background,
        body: Center(child: CircularProgressIndicator(color: AppColors.primary)),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      body: AmbientBackground(
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.arrow_back_ios_new_rounded, color: AppColors.textPrimary, size: 20),
                      onPressed: () => context.pop(),
                    ),
                    const SizedBox(width: 8),
                    const Text(
                      'Edit Listing',
                      style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: AppColors.textPrimary),
                    ),
                  ],
                ),
              ),

              Expanded(
                child: ListView(
                  padding: const EdgeInsets.all(20),
                  children: [
                    GlassContainer(
                      level: GlassLevel.subtle,
                      borderRadius: BorderRadius.circular(20),
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Title *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textSecondary)),
                          const SizedBox(height: 6),
                          TextField(controller: _titleCtrl, style: const TextStyle(color: Colors.white, fontSize: 14)),
                          const SizedBox(height: 14),

                          const Text('Daily Rental Rate (₹/day) *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textSecondary)),
                          const SizedBox(height: 6),
                          TextField(controller: _priceCtrl, keyboardType: TextInputType.number, style: const TextStyle(color: Colors.white, fontSize: 14)),
                          const SizedBox(height: 14),

                          // Security Deposit Decision Card
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: AppColors.surface,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: AppColors.border),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          const Text('Take Security Deposit?',
                                              style: TextStyle(
                                                  fontSize: 13,
                                                  fontWeight: FontWeight.w700,
                                                  color: Colors.white)),
                                          const SizedBox(height: 2),
                                          Text(
                                              _requiresDeposit
                                                  ? 'Hold a refundable deposit from renter'
                                                  : 'No deposit required (0% deposit)',
                                              style: const TextStyle(
                                                  fontSize: 11,
                                                  color: AppColors.textSecondary)),
                                        ],
                                      ),
                                    ),
                                    Switch.adaptive(
                                      value: _requiresDeposit,
                                      activeColor: AppColors.primary,
                                      onChanged: (val) {
                                        setState(() {
                                          _requiresDeposit = val;
                                          if (!val) {
                                            _depositCtrl.text = '0';
                                          } else if (_depositCtrl.text == '0' || _depositCtrl.text.isEmpty) {
                                            _depositCtrl.text = '1000';
                                          }
                                        });
                                      },
                                    ),
                                  ],
                                ),
                                if (_requiresDeposit) ...[
                                  const SizedBox(height: 10),
                                  const Divider(height: 1, color: AppColors.border),
                                  const SizedBox(height: 10),
                                  const Text('Refundable Security Deposit (₹) *',
                                      style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w700,
                                          color: AppColors.textSecondary)),
                                  const SizedBox(height: 6),
                                  TextField(
                                    controller: _depositCtrl,
                                    keyboardType: TextInputType.number,
                                    style: const TextStyle(
                                        color: Colors.white, fontSize: 14),
                                    decoration: const InputDecoration(
                                        hintText: 'e.g. 2000',
                                        prefixText: '₹ '),
                                  ),
                                ],
                              ],
                            ),
                          ),
                          const SizedBox(height: 14),

                          const Text('Location / Neighborhood *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textSecondary)),
                          const SizedBox(height: 6),
                          TextField(controller: _locationCtrl, style: const TextStyle(color: Colors.white, fontSize: 14)),
                          const SizedBox(height: 14),

                          Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text('Min Days', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textSecondary)),
                                    const SizedBox(height: 6),
                                    TextField(controller: _minDaysCtrl, keyboardType: TextInputType.number, style: const TextStyle(color: Colors.white, fontSize: 14)),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text('Max Days', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textSecondary)),
                                    const SizedBox(height: 6),
                                    TextField(controller: _maxDaysCtrl, keyboardType: TextInputType.number, style: const TextStyle(color: Colors.white, fontSize: 14)),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 14),

                          const Text('Description *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textSecondary)),
                          const SizedBox(height: 6),
                          TextField(controller: _descCtrl, maxLines: 4, style: const TextStyle(color: Colors.white, fontSize: 14)),
                          const SizedBox(height: 16),

                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text('Photos', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textSecondary)),
                              TextButton.icon(
                                icon: const Icon(Icons.add_a_photo_outlined, size: 16, color: AppColors.accent),
                                label: const Text('Add Photo', style: TextStyle(color: AppColors.accent, fontSize: 12)),
                                onPressed: _pickImage,
                              ),
                            ],
                          ),
                          if (_images.isNotEmpty)
                            SizedBox(
                              height: 60,
                              child: ListView.separated(
                                scrollDirection: Axis.horizontal,
                                itemCount: _images.length,
                                separatorBuilder: (_, __) => const SizedBox(width: 8),
                                itemBuilder: (ctx, idx) => ClipRRect(
                                  borderRadius: BorderRadius.circular(8),
                                  child: Image.network(_images[idx], width: 60, height: 60, fit: BoxFit.cover),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 24),

                    SizedBox(
                      height: 50,
                      child: ElevatedButton(
                        onPressed: _isSaving ? null : _saveListing,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        ),
                        child: _isSaving
                            ? const CircularProgressIndicator(color: Colors.white)
                            : const Text('Update Listing', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white)),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
