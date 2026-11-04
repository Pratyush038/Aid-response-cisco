import 'dart:ui';
import 'package:flutter/material.dart';

class GlassCard extends StatelessWidget {
  final Widget child;
  final double blur;
  final double borderRadius;
  final EdgeInsetsGeometry padding;
  final Color? borderColor;
  final List<Color>? gradientColors;

  const GlassCard({
    super.key,
    required this.child,
    this.blur = 15.0,
    this.borderRadius = 16.0,
    this.padding = const EdgeInsets.all(16.0),
    this.borderColor,
    this.gradientColors,
  });

  @override
  Widget build(BuildContext context) {
    final finalBorderColor = borderColor ?? Colors.white.withOpacity(0.08);
    final finalGradientColors = gradientColors ?? [
      Colors.white.withOpacity(0.05),
      Colors.white.withOpacity(0.02),
    ];

    return ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: blur, sigmaY: blur),
        child: Container(
          padding: padding,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(borderRadius),
            border: Border.all(
              color: finalBorderColor,
              width: 1.2,
            ),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: finalGradientColors,
            ),
          ),
          child: child,
        ),
      ),
    );
  }
}
