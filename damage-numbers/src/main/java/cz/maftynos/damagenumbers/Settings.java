package cz.maftynos.damagenumbers;

import java.util.logging.Logger;
import org.bukkit.configuration.file.FileConfiguration;

record Settings(boolean players, boolean mobs, boolean combatOnly,
                boolean hearts, int decimals, boolean showMiss, int lifetime,
                double rise, double drift, double side, double height,
                float scale, double range, int maxActive, boolean assumeFont) {
    static Settings load(FileConfiguration c, Logger log) {
        return new Settings(c.getBoolean("targets.players", true), c.getBoolean("targets.mobs", false),
                c.getBoolean("targets.combat-only", false), c.getBoolean("numbers.hearts", false),
                (int) number(c, log, "numbers.decimals", 1, 0, 2), c.getBoolean("numbers.show-miss", true),
                (int) number(c, log, "animation.lifetime-ticks", 24, 4, 100),
                number(c, log, "animation.rise-blocks", .65, 0, 4),
                number(c, log, "animation.horizontal-drift", .12, 0, 2),
                number(c, log, "animation.side-offset", .7, 0, 3),
                number(c, log, "animation.height-offset", 1.15, -1, 5),
                (float) number(c, log, "animation.scale", 1, .1, 5),
                number(c, log, "animation.viewer-range", 24, 1, 64),
                (int) number(c, log, "animation.max-active", 80, 1, 500),
                c.getBoolean("font.assume-installed", false));
    }

    private static double number(FileConfiguration c, Logger log, String key, double fallback,
                                 double min, double max) {
        Object raw = c.get(key);
        if (raw == null) return fallback;
        if (raw instanceof Number n && Double.isFinite(n.doubleValue())
                && n.doubleValue() >= min && n.doubleValue() <= max) return n.doubleValue();
        log.warning("Invalid " + key + "; using " + fallback + " (range " + min + ".." + max + ")");
        return fallback;
    }
}
