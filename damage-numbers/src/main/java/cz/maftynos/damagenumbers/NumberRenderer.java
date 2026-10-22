package cz.maftynos.damagenumbers;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import net.kyori.adventure.key.Key;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextColor;
import org.bukkit.Color;
import org.bukkit.Location;
import org.bukkit.entity.Display;
import org.bukkit.entity.Entity;
import org.bukkit.entity.LivingEntity;
import org.bukkit.entity.Player;
import org.bukkit.entity.TextDisplay;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.util.Transformation;
import org.bukkit.util.Vector;
import org.joml.Quaternionf;
import org.joml.Vector3f;

final class NumberRenderer {
    private static final Key FONT = Key.key("orange_damage:numbers");
    private final DamageNumbersPlugin plugin;
    private final PackManager packs;
    private final Map<UUID, FloatingNumber> active = new LinkedHashMap<>();

    NumberRenderer(DamageNumbersPlugin plugin, PackManager packs) {
        this.plugin = plugin;
        this.packs = packs;
    }

    void show(LivingEntity victim, double damage) {
        Settings s = plugin.settings();
        if (damage == 0 && !s.showMiss()) return;
        String text = DamageFormat.format(damage, s.decimals(), s.hearts());
        List<Player> custom = new ArrayList<>();
        List<Player> fallback = new ArrayList<>();
        for (Player viewer : victim.getWorld().getPlayers()) {
            if (viewer.getLocation().distanceSquared(victim.getLocation()) > s.range() * s.range()) continue;
            if (victim instanceof Player player && !viewer.canSee(player)) continue;
            (packs.hasFont(viewer) ? custom : fallback).add(viewer);
        }
        if (custom.isEmpty() && fallback.isEmpty()) return;
        while (active.size() >= s.maxActive()) {
            Iterator<FloatingNumber> it = active.values().iterator();
            it.next().remove();
            it.remove();
        }
        double side = ThreadLocalRandom.current().nextBoolean() ? 1 : -1;
        double yaw = Math.toRadians(victim.getLocation().getYaw());
        Vector direction = new Vector(Math.cos(yaw) * side, 0, Math.sin(yaw) * side);
        Location origin = victim.getLocation().add(direction.clone().multiply(s.side()));
        origin.add(0, Math.min(s.height(), victim.getHeight() + .15), 0);
        List<TextDisplay> entities = new ArrayList<>(2);
        try {
            if (!custom.isEmpty()) entities.add(spawn(origin, text, true, custom, s));
            if (!fallback.isEmpty()) entities.add(spawn(origin, text, false, fallback, s));
        } catch (RuntimeException ex) {
            entities.forEach(Entity::remove);
            plugin.getLogger().warning("Could not create damage number: " + ex.getMessage());
            return;
        }
        FloatingNumber number = new FloatingNumber(entities, origin, direction.multiply(s.drift()), s);
        active.put(entities.get(0).getUniqueId(), number);
    }

    private TextDisplay spawn(Location location, String text, boolean custom,
                              List<Player> viewers, Settings s) {
        TextDisplay display = location.getWorld().spawn(location, TextDisplay.class, entity -> {
            entity.setVisibleByDefault(false);
            entity.setPersistent(false);
            entity.getPersistentDataContainer().set(plugin.marker(), PersistentDataType.BYTE, (byte) 1);
            entity.addScoreboardTag("orange_damage_number");
            entity.setBillboard(Display.Billboard.CENTER);
            entity.setGravity(false);
            entity.setInvulnerable(true);
            entity.setSilent(true);
            entity.setDefaultBackground(false);
            entity.setBackgroundColor(Color.fromARGB(0, 0, 0, 0));
            entity.setShadowed(!custom);
            entity.setSeeThrough(false);
            entity.setBrightness(new Display.Brightness(15, 15));
            entity.setViewRange((float) (s.range() / 64.0));
            entity.setDisplayWidth(3);
            entity.setDisplayHeight(2);
            entity.setLineWidth(1000);
            entity.setAlignment(TextDisplay.TextAlignment.CENTER);
            entity.setTeleportDuration(1);
            entity.setInterpolationDelay(0);
            entity.setInterpolationDuration(2);
            entity.setTransformation(new Transformation(new Vector3f(), new Quaternionf(),
                    new Vector3f(s.scale()), new Quaternionf()));
            Component component = Component.text(text);
            entity.text(custom ? component.font(FONT).color(NamedTextColor.WHITE)
                    : component.color(TextColor.color(0xff9a16)));
        });
        try {
            viewers.forEach(viewer -> viewer.showEntity(plugin, display));
            return display;
        } catch (RuntimeException ex) {
            display.remove();
            throw ex;
        }
    }

    void tick() {
        Iterator<FloatingNumber> it = active.values().iterator();
        while (it.hasNext()) {
            FloatingNumber number = it.next();
            if (!number.tick()) {
                number.remove();
                it.remove();
            }
        }
    }

    boolean isManaged(Entity entity) {
        return active.values().stream().anyMatch(n -> n.entities.contains(entity));
    }

    void clear() {
        active.values().forEach(FloatingNumber::remove);
        active.clear();
    }

    private static final class FloatingNumber {
        private final List<TextDisplay> entities;
        private final Location origin;
        private final Vector drift;
        private final Settings settings;
        private int age;

        FloatingNumber(List<TextDisplay> entities, Location origin, Vector drift, Settings settings) {
            this.entities = entities;
            this.origin = origin;
            this.drift = drift;
            this.settings = settings;
        }

        boolean tick() {
            if (++age >= settings.lifetime() || entities.stream().anyMatch(e -> !e.isValid())) return false;
            double progress = (double) age / settings.lifetime();
            Location next = origin.clone().add(drift.clone().multiply(progress));
            next.add(0, settings.rise() * (1 - Math.pow(1 - progress, 2)), 0);
            if (!next.getWorld().isChunkLoaded(next.getBlockX() >> 4, next.getBlockZ() >> 4)) return false;
            for (TextDisplay entity : entities) {
                if (!entity.teleport(next)) return false;
                if (progress > .65) {
                    // TextDisplay opacity 0..3 renders as opaque: use 4..255, then remove.
                    int alpha = Math.max(4, (int) Math.round(255 * (1 - progress) / .35));
                    entity.setTextOpacity((byte) alpha);
                }
            }
            return true;
        }

        void remove() {
            entities.forEach(Entity::remove);
        }
    }
}
