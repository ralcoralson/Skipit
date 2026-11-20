import 'dart:ui';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/theme/app_colors.dart';
import '../../providers/listings_provider.dart';
import '../../providers/location_provider.dart';
import '../../widgets/ambient_background.dart';
import '../../widgets/glass_container.dart';

class CreateListingScreen extends ConsumerStatefulWidget {
  const CreateListingScreen({super.key});

  @override
  ConsumerState<CreateListingScreen> createState() =>
      _CreateListingScreenState();
}

class _CreateListingScreenState extends ConsumerState<CreateListingScreen> {
  final _titleController = TextEditingController();
  final _descController = TextEditingController();
  final _priceController = TextEditingController();
  final _depositController = TextEditingController(text: '0');
  final _locationController = TextEditingController();
  final _brandController = TextEditingController();
  final _modelController = TextEditingController();

  bool _requiresDeposit = false;
  String _selectedCategory = 'Cameras & Photography';
  String _selectedCondition = 'good';
  final List<XFile> _selectedImages = [];
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    final loc = ref.read(locationProvider).formattedLocation;
    _locationController.text = loc;
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descController.dispose();
    _priceController.dispose();
    _depositController.dispose();
    _locationController.dispose();
    _brandController.dispose();
    _modelController.dispose();
    super.dispose();
  }

  void _pickImages() async {
    final picker = ImagePicker();
    final picked = await picker.pickMultiImage();
    if (picked.isNotEmpty) {
      setState(() {
        _selectedImages.addAll(picked);
      });
    }
  }

  void _handleSubmit() async {
    final title = _titleController.text.trim();
    final desc = _descController.text.trim();
    final price = _priceController.text.trim();
    final location = _locationController.text.trim();

    if (title.isEmpty || desc.isEmpty || price.isEmpty || location.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please fill in all required fields.')),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final formData = FormData.fromMap({
        'title': title,
        'description': desc,
        'category': _selectedCategory,
        'condition': _selectedCondition,
        'price_per_day': price,
        'deposit_amount': _requiresDeposit ? (_depositController.text.trim().isEmpty ? '0' : _depositController.text.trim()) : '0',
        'location_name': location,
        'brand': _brandController.text.trim(),
        'model': _modelController.text.trim(),
      });

      for (final img in _selectedImages) {
        formData.files.add(MapEntry(
          'images',
          await MultipartFile.fromFile(img.path, filename: img.name),
        ));
      }

      final success =
          await ref.read(listingsProvider.notifier).createListing(formData);

      if (success && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Rental item published successfully!')),
        );
        context.pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to publish: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final categories = ref.watch(listingsProvider).categories;

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(60),
        child: ClipRRect(
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
            child: Container(
              color: Colors.white.withOpacity(0.72),
              padding: EdgeInsets.only(
                top: MediaQuery.of(context).padding.top + 4,
                bottom: 8,
                left: 8,
                right: 16,
              ),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back_rounded,
                        color: AppColors.textPrimary),
                    onPressed: () => context.pop(),
                  ),
                  const Text(
                    'Post Rental Listing',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
      body: AmbientBackground(
        child: SingleChildScrollView(
          padding: EdgeInsets.only(
            top: MediaQuery.of(context).padding.top + 76,
            bottom: 40,
            left: 16,
            right: 16,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Photos Section
              GlassContainer(
                level: GlassLevel.standard,
                padding: const EdgeInsets.all(16),
                borderRadius: BorderRadius.circular(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Product Images',
                          style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w800,
                              color: AppColors.textPrimary),
                        ),
                        Text(
                          '${_selectedImages.length} selected',
                          style: const TextStyle(
                              fontSize: 11, color: AppColors.textMuted),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      height: 84,
                      child: ListView(
                        scrollDirection: Axis.horizontal,
                        children: [
                          GestureDetector(
                            onTap: _pickImages,
                            child: Container(
                              width: 84,
                              decoration: BoxDecoration(
                                color: AppColors.light.withOpacity(0.4),
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(
                                  color: AppColors.accent.withOpacity(0.5),
                                  style: BorderStyle.solid,
                                ),
                              ),
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: const [
                                  Icon(Icons.add_photo_alternate_rounded,
                                      color: AppColors.primary, size: 24),
                                  SizedBox(height: 4),
                                  Text(
                                    'Upload',
                                    style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w700,
                                        color: AppColors.primary),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          ..._selectedImages.asMap().entries.map((entry) {
                            final idx = entry.key;
                            final img = entry.value;
                            return Stack(
                              children: [
                                Container(
                                  width: 84,
                                  margin: const EdgeInsets.only(right: 10),
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(16),
                                    border: Border.all(
                                        color: Colors.white.withOpacity(0.8)),
                                    image: DecorationImage(
                                        image: NetworkImage(img.path),
                                        fit: BoxFit.cover),
                                  ),
                                ),
                                Positioned(
                                  top: 4,
                                  right: 14,
                                  child: GestureDetector(
                                    onTap: () {
                                      setState(
                                          () => _selectedImages.removeAt(idx));
                                    },
                                    child: Container(
                                      padding: const EdgeInsets.all(3),
                                      decoration: const BoxDecoration(
                                        color: Colors.black54,
                                        shape: BoxShape.circle,
                                      ),
                                      child: const Icon(Icons.close_rounded,
                                          size: 12, color: Colors.white),
                                    ),
                                  ),
                                ),
                              ],
                            );
                          }),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // Product Info Form Glass Card
              GlassContainer(
                level: GlassLevel.standard,
                padding: const EdgeInsets.all(18),
                borderRadius: BorderRadius.circular(22),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Title *',
                        style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            color: AppColors.textPrimary)),
                    const SizedBox(height: 6),
                    TextField(
                      controller: _titleController,
                      style: const TextStyle(
                          fontSize: 13, color: AppColors.textPrimary),
                      decoration: const InputDecoration(
                        hintText:
                            'e.g. Sony A7 IV Camera Body + 24-70mm GM Lens',
                      ),
                    ),
                    const SizedBox(height: 16),

                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Category *',
                                  style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w800,
                                      color: AppColors.textPrimary)),
                              const SizedBox(height: 6),
                              DropdownButtonFormField<String>(
                                value: categories
                                        .any((c) => c.name == _selectedCategory)
                                    ? _selectedCategory
                                    : null,
                                style: const TextStyle(
                                    fontSize: 12, color: AppColors.textPrimary),
                                items: categories.map((c) {
                                  return DropdownMenuItem(
                                      value: c.name,
                                      child: Text(c.name,
                                          style:
                                              const TextStyle(fontSize: 12)));
                                }).toList(),
                                onChanged: (val) {
                                  if (val != null) {
                                    setState(() => _selectedCategory = val);
                                  }
                                },
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Condition *',
                                  style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w800,
                                      color: AppColors.textPrimary)),
                              const SizedBox(height: 6),
                              DropdownButtonFormField<String>(
                                value: _selectedCondition,
                                style: const TextStyle(
                                    fontSize: 12, color: AppColors.textPrimary),
                                items: const [
                                  DropdownMenuItem(
                                      value: 'brand_new',
                                      child: Text('Brand New',
                                          style: TextStyle(fontSize: 12))),
                                  DropdownMenuItem(
                                      value: 'like_new',
                                      child: Text('Like New',
                                          style: TextStyle(fontSize: 12))),
                                  DropdownMenuItem(
                                      value: 'good',
                                      child: Text('Good',
                                          style: TextStyle(fontSize: 12))),
                                  DropdownMenuItem(
                                      value: 'fair',
                                      child: Text('Fair',
                                          style: TextStyle(fontSize: 12))),
                                ],
                                onChanged: (val) {
                                  if (val != null) {
                                    setState(() => _selectedCondition = val);
                                  }
                                },
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),

                    // Daily Price
                    const Text('Daily Rental Rate (₹/day) *',
                        style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            color: AppColors.textPrimary)),
                    const SizedBox(height: 6),
                    TextField(
                      controller: _priceController,
                      keyboardType: TextInputType.number,
                      style: const TextStyle(
                          fontSize: 13, color: AppColors.textPrimary),
                      decoration: const InputDecoration(hintText: '850'),
                    ),
                    const SizedBox(height: 16),

                    // Security Deposit Option Card
                    Container(
                      padding: const EdgeInsets.all(14),
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
                                            fontWeight: FontWeight.w800,
                                            color: AppColors.textPrimary)),
                                    const SizedBox(height: 2),
                                    Text(
                                        _requiresDeposit
                                            ? 'Hold a refundable deposit from renter'
                                            : 'No deposit required (0% deposit)',
                                        style: const TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.w500,
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
                                      _depositController.text = '0';
                                    } else if (_depositController.text == '0' || _depositController.text.isEmpty) {
                                      _depositController.text = '1000';
                                    }
                                  });
                                },
                              ),
                            ],
                          ),
                          if (_requiresDeposit) ...[
                            const SizedBox(height: 12),
                            const Divider(height: 1, color: AppColors.border),
                            const SizedBox(height: 12),
                            const Text('Refundable Deposit Amount (₹) *',
                                style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w800,
                                    color: AppColors.textPrimary)),
                            const SizedBox(height: 6),
                            TextField(
                              controller: _depositController,
                              keyboardType: TextInputType.number,
                              style: const TextStyle(
                                  fontSize: 13, color: AppColors.textPrimary),
                              decoration: const InputDecoration(
                                  hintText: 'e.g. 2000',
                                  prefixText: '₹ '),
                            ),
                            const SizedBox(height: 6),
                            const Text(
                                'Settled directly with renter via UPI or cash upon handover and returned after inspection.',
                                style: TextStyle(
                                    fontSize: 10,
                                    color: AppColors.textSecondary)),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Location
                    const Text('Location / Neighborhood *',
                        style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            color: AppColors.textPrimary)),
                    const SizedBox(height: 6),
                    TextField(
                      controller: _locationController,
                      style: const TextStyle(
                          fontSize: 13, color: AppColors.textPrimary),
                      decoration: const InputDecoration(
                        prefixIcon: Icon(Icons.location_on_outlined, size: 18),
                        hintText: 'e.g. Indiranagar, Bengaluru',
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Description
                    const Text('Detailed Description *',
                        style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            color: AppColors.textPrimary)),
                    const SizedBox(height: 6),
                    TextField(
                      controller: _descController,
                      maxLines: 4,
                      style: const TextStyle(
                          fontSize: 13, color: AppColors.textPrimary),
                      decoration: const InputDecoration(
                        hintText:
                            'Describe equipment specs, included accessories, pickup terms...',
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // Publish Button
              GestureDetector(
                onTap: _isSubmitting ? null : _handleSubmit,
                child: Container(
                  width: double.infinity,
                  height: 52,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [AppColors.primary, AppColors.accent],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(18),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.primary.withOpacity(0.35),
                        blurRadius: 14,
                        offset: const Offset(0, 5),
                      ),
                    ],
                  ),
                  alignment: Alignment.center,
                  child: _isSubmitting
                      ? const SizedBox(
                          height: 22,
                          width: 22,
                          child: CircularProgressIndicator(
                              strokeWidth: 2.5, color: Colors.white),
                        )
                      : const Text(
                          'Publish Listing (0% Commission)',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
