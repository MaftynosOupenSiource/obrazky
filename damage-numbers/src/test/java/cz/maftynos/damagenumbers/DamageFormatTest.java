package cz.maftynos.damagenumbers;

import java.util.Locale;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class DamageFormatTest {
    @Test
    void actualZeroIsMissInEitherUnit() {
        assertAll(
                () -> assertEquals("MISS", DamageFormat.format(0, 0, false)),
                () -> assertEquals("MISS", DamageFormat.format(0, 2, true)),
                () -> assertEquals("MISS", DamageFormat.format(-0.0, 1, false)));
    }

    @Test
    void usesDecimalHalfUpRounding() {
        assertAll(
                () -> assertEquals("2", DamageFormat.format(1.5, 0, false)),
                () -> assertEquals("1.3", DamageFormat.format(1.25, 1, false)),
                () -> assertEquals("1.2", DamageFormat.format(1.249, 1, false)),
                () -> assertEquals("1.01", DamageFormat.format(1.005, 2, false)),
                () -> assertEquals("9.99", DamageFormat.format(9.994, 2, false)),
                () -> assertEquals("10", DamageFormat.format(9.995, 2, false)));
    }

    @Test
    void removesTrailingZeroesAndAvoidsScientificNotation() {
        assertAll(
                () -> assertEquals("4", DamageFormat.format(4, 2, false)),
                () -> assertEquals("4.5", DamageFormat.format(4.5, 2, false)),
                () -> assertEquals("100000000", DamageFormat.format(100000000, 2, false)));
    }

    @Test
    void positiveHitsNeverAppearAsZeroOrMiss() {
        assertAll(
                () -> assertEquals("1", DamageFormat.format(0.01, 0, false)),
                () -> assertEquals("0.1", DamageFormat.format(0.04, 1, false)),
                () -> assertEquals("0.01", DamageFormat.format(0.004, 2, false)),
                () -> assertEquals("0.01", DamageFormat.format(Double.MIN_VALUE, 2, false)),
                () -> assertEquals("0.01", DamageFormat.format(Double.MIN_VALUE, 2, true)));
    }

    @Test
    void convertsHealthPointsToHeartsBeforeRounding() {
        assertAll(
                () -> assertEquals("2", DamageFormat.format(4, 2, true)),
                () -> assertEquals("1.3", DamageFormat.format(2.5, 1, true)),
                () -> assertEquals("0.5", DamageFormat.format(1, 2, true)),
                () -> assertEquals("1", DamageFormat.format(1, 1, false)));
    }

    @Test
    void invalidDamageIsRejected() {
        for (double damage : new double[] {-0.001, -1, Double.NaN,
                Double.POSITIVE_INFINITY, Double.NEGATIVE_INFINITY}) {
            assertThrows(IllegalArgumentException.class,
                    () -> DamageFormat.format(damage, 1, false));
        }
    }

    @Test
    void invalidPrecisionIsRejectedEvenForMiss() {
        assertAll(
                () -> assertThrows(IllegalArgumentException.class,
                        () -> DamageFormat.format(1, -1, false)),
                () -> assertThrows(IllegalArgumentException.class,
                        () -> DamageFormat.format(0, 3, false)));
    }

    @Test
    void localeCannotChangeGlyphsOrDecimalSeparator() {
        Locale original = Locale.getDefault();
        try {
            for (Locale locale : new Locale[] {Locale.GERMANY,
                    Locale.forLanguageTag("cs-CZ"), Locale.forLanguageTag("ar-EG")}) {
                Locale.setDefault(locale);
                assertEquals("12.5", DamageFormat.format(12.5, 1, false));
                assertEquals("MISS", DamageFormat.format(0, 1, false));
            }
        } finally {
            Locale.setDefault(original);
        }
    }
}
