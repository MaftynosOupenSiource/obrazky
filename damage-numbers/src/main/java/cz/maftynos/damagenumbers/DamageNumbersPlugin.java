package cz.maftynos.damagenumbers;

import java.io.File;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.NamespacedKey;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Entity;
import org.bukkit.entity.LivingEntity;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.EntityDamageByEntityEvent;
import org.bukkit.event.entity.EntityDamageEvent;
import org.bukkit.event.world.ChunkLoadEvent;
import org.bukkit.plugin.java.JavaPlugin;

public final class DamageNumbersPlugin extends JavaPlugin implements Listener {
    private Settings settings;
    private PackManager packs;
    private NumberRenderer renderer;
    private NamespacedKey marker;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        settings = Settings.load(getConfig(), getLogger());
        marker = new NamespacedKey(this, "floating_number");
        packs = new PackManager(this);
        renderer = new NumberRenderer(this, packs);
        getServer().getWorlds().forEach(world -> world.getEntities().forEach(this::removeOrphan));
        getServer().getPluginManager().registerEvents(this, this);
        getServer().getPluginManager().registerEvents(packs, this);
        Objects.requireNonNull(getCommand("damagenumbers")).setExecutor(this);
        Objects.requireNonNull(getCommand("damagenumbers")).setTabCompleter(this);
        getServer().getScheduler().runTaskTimer(this, renderer::tick, 1, 1);
        File zip = new File(getDataFolder(), "OrangeDamageNumbers-resource-pack.zip");
        if (!zip.exists()) saveResource(zip.getName(), false);
        getServer().getOnlinePlayers().forEach(packs::offer);
        getLogger().info("OrangeDamageNumbers enabled. /dn test 12.5 | /dn test 0 (MISS)");
    }

    @Override
    public void onDisable() {
        if (renderer != null) renderer.clear();
    }

    Settings settings() { return settings; }
    NamespacedKey marker() { return marker; }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onDamage(EntityDamageEvent event) {
        if (!(event.getEntity() instanceof LivingEntity victim)) return;
        if (victim instanceof Player ? !settings.players() : !settings.mobs()) return;
        if (settings.combatOnly() && !(event instanceof EntityDamageByEntityEvent)) return;
        double damage = event.getFinalDamage();
        if (Double.isFinite(damage) && damage >= 0) renderer.show(victim, damage);
    }

    @EventHandler
    public void onChunkLoad(ChunkLoadEvent event) {
        Arrays.stream(event.getChunk().getEntities()).forEach(this::removeOrphan);
    }

    private void removeOrphan(Entity entity) {
        if (entity.getPersistentDataContainer().has(marker) && !renderer.isManaged(entity)) entity.remove();
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!sender.hasPermission("damagenumbers.admin")) {
            sender.sendMessage(Component.text("Nemáš oprávnění.", NamedTextColor.RED));
            return true;
        }
        if (args.length == 0) return usage(sender);
        switch (args[0].toLowerCase(Locale.ROOT)) {
            case "reload" -> {
                reloadConfig();
                settings = Settings.load(getConfig(), getLogger());
                renderer.clear();
                packs.reload();
                getServer().getOnlinePlayers().forEach(packs::offer);
                sender.sendMessage(Component.text("Konfigurace načtena.", NamedTextColor.GREEN));
            }
            case "test" -> {
                if (!(sender instanceof Player player)) {
                    sender.sendMessage("Test spusť jako hráč ve hře.");
                    return true;
                }
                try {
                    double damage = args.length > 1 ? Double.parseDouble(args[1]) : 12.5;
                    if (!Double.isFinite(damage) || damage < 0 || damage > 1_000_000) {
                        throw new NumberFormatException();
                    }
                    renderer.show(player, damage);
                } catch (NumberFormatException ex) {
                    sender.sendMessage(Component.text("Použij /dn test 12.5 nebo /dn test 0 (MISS).", NamedTextColor.RED));
                }
            }
            case "pack" -> {
                if (!(sender instanceof Player player)) {
                    sender.sendMessage("Pack si vyžádej jako hráč ve hře.");
                } else if (!packs.offer(player)) {
                    sender.sendMessage(Component.text("Nejdřív nastav resource-pack.url a sha1 v config.yml.", NamedTextColor.YELLOW));
                }
            }
            default -> { return usage(sender); }
        }
        return true;
    }

    private boolean usage(CommandSender sender) {
        sender.sendMessage(Component.text("/dn test [damage] | /dn reload | /dn pack", NamedTextColor.GOLD));
        return true;
    }

    @Override
    public List<String> onTabComplete(CommandSender sender, Command command, String alias, String[] args) {
        if (!sender.hasPermission("damagenumbers.admin")) return List.of();
        if (args.length == 1) return List.of("test", "reload", "pack").stream()
                .filter(s -> s.startsWith(args[0].toLowerCase(Locale.ROOT))).toList();
        if (args.length == 2 && args[0].equalsIgnoreCase("test")) return List.of("0", "5", "12.5");
        return List.of();
    }
}
