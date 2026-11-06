package cz.maftynos.smoothwither;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import io.papermc.paper.event.entity.EntityPushedByEntityAttackEvent;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.EntityDamageEvent;
import org.bukkit.event.entity.PlayerDeathEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.event.player.PlayerRespawnEvent;
import org.bukkit.event.player.PlayerTeleportEvent;
import org.bukkit.event.player.PlayerVelocityEvent;
import org.bukkit.plugin.java.JavaPlugin;

/** Suppresses only Wither's redundant velocity resync, preserving native damage. */
public final class SmoothWitherPlugin extends JavaPlugin implements Listener {
    private final Map<UUID, PendingHit> pending = new HashMap<>();
    private final Map<UUID, Integer> realImpulseTick = new HashMap<>();

    @Override
    public void onEnable() {
        getServer().getPluginManager().registerEvents(this, this);
        getLogger().info("SmoothWither enabled: Wither damage is preserved; redundant movement resync is suppressed.");
    }

    @Override
    public void onDisable() {
        pending.clear();
        realImpulseTick.clear();
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void observeDamage(EntityDamageEvent event) {
        if (!(event.getEntity() instanceof Player player)) return;
        UUID id = player.getUniqueId();
        if (!event.isCancelled()
                && event.getCause() == EntityDamageEvent.DamageCause.WITHER
                && event.getDamage() > 0) {
            // Wither has no attacker and no physical knockback, but markHurt()
            // schedules an unnecessary motion packet. Include absorbed ticks:
            // getFinalDamage() can be zero while absorption still takes damage.
            pending.put(id, new PendingHit(event, Bukkit.getCurrentTick()));
        } else {
            pending.remove(id);
            if (!event.isCancelled() && event.getCause() != EntityDamageEvent.DamageCause.WITHER) {
                realImpulseTick.put(id, Bukkit.getCurrentTick());
            }
        }
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void observeKnockback(EntityPushedByEntityAttackEvent event) {
        if (event.getEntity() instanceof Player player) preserveImpulse(player);
    }

    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = true)
    public void onVelocity(PlayerVelocityEvent event) {
        Player player = event.getPlayer();
        UUID id = player.getUniqueId();
        PendingHit hit = pending.remove(id);
        if (hit == null || player.isDead()) return;
        int now = Bukkit.getCurrentTick();
        int age = now - hit.tick();
        // World tracking runs before entity/effect ticking. Natural Wither
        // normally produces its velocity resync on the FOLLOWING tick.
        if (age < 0 || age > 1) return;
        if (player.getLastDamageCause() != hit.damage()) return;
        Integer impulse = realImpulseTick.get(id);
        if (impulse != null && (impulse == hit.tick() || impulse == now)) return;
        // Preserve intentional changes by earlier velocity-event listeners.
        // Compare with CURRENT velocity: the pre-hit value can legitimately
        // change from jump/gravity physics before the following tracker tick.
        if (event.getVelocity().distanceSquared(player.getVelocity()) > 1.0e-10) return;
        event.setCancelled(true);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onTeleport(PlayerTeleportEvent event) { preserveImpulse(event.getPlayer()); }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onRespawn(PlayerRespawnEvent event) { preserveImpulse(event.getPlayer()); }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onDeath(PlayerDeathEvent event) { forget(event.getEntity()); }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onQuit(PlayerQuitEvent event) { forget(event.getPlayer()); }

    private void preserveImpulse(Player player) {
        pending.remove(player.getUniqueId());
        realImpulseTick.put(player.getUniqueId(), Bukkit.getCurrentTick());
    }

    private void forget(Player player) {
        pending.remove(player.getUniqueId());
        realImpulseTick.remove(player.getUniqueId());
    }

    private record PendingHit(EntityDamageEvent damage, int tick) { }
}
