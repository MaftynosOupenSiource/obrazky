package cz.maftynos.damagenumbers;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Converts damage into locale-independent text supported by the bitmap font. */
public final class DamageFormat {
    private static final BigDecimal TWO = BigDecimal.valueOf(2);

    private DamageFormat() {
    }

    /**
     * Formats zero as MISS and positive damage using at most the requested precision.
     * Positive damage that would round to zero is shown as the smallest displayable
     * positive value, so a successful hit is never incorrectly labelled MISS or 0.
     *
     * @param damage nonnegative finite damage in Minecraft health points
     * @param decimals number of decimal places, from zero to two inclusive
     * @param hearts whether to convert health points into hearts (two points each)
     * @return ASCII text containing digits, a decimal point, or MISS
     */
    public static String format(double damage, int decimals, boolean hearts) {
        if (!Double.isFinite(damage) || damage < 0) {
            throw new IllegalArgumentException("Damage must be finite and nonnegative");
        }
        if (decimals < 0 || decimals > 2) {
            throw new IllegalArgumentException("Decimal places must be between 0 and 2");
        }
        if (damage == 0) {
            return "MISS";
        }

        BigDecimal amount = BigDecimal.valueOf(damage);
        if (hearts) {
            amount = amount.divide(TWO);
        }
        BigDecimal rounded = amount.setScale(decimals, RoundingMode.HALF_UP);
        if (rounded.signum() == 0) {
            rounded = BigDecimal.ONE.movePointLeft(decimals);
        }
        return rounded.stripTrailingZeros().toPlainString();
    }
}
