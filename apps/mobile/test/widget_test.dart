import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:skipit/main.dart';

void main() {
  testWidgets('SkipIt mobile app boots and displays branding', (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: SkipItMobileApp(),
      ),
    );

    // Initial frame displays splash branding
    expect(find.text('skipit'), findsOneWidget);
    expect(find.text('Skip Buying. Rent Smarter.'), findsOneWidget);

    // Let the 2-second splash timer elapse
    await tester.pump(const Duration(seconds: 2));
    await tester.pump(const Duration(milliseconds: 100));
  });
}
