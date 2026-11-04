import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aid_response/main.dart';

void main() {
  testWidgets('App smoke test - verifies AuthGate renders initially', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(
      const ProviderScope(
        child: AidResponseApp(),
      ),
    );

    // Verify that the AuthScreen title is present (AID-RESPONSE)
    expect(find.text('AID-RESPONSE'), findsOneWidget);
  });
}
