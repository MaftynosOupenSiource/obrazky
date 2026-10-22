package cz.maftynos.damagenumbers;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.Set;
import java.util.UUID;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.event.player.PlayerResourcePackStatusEvent;

final class PackManager implements Listener {
    private static final UUID PACK_ID = UUID.nameUUIDFromBytes(
            "orange_damage:brush_numbers".getBytes(StandardCharsets.UTF_8));
    private final DamageNumbersPlugin plugin;
    private final Set<UUID> loaded = new HashSet<>();
    private String url = "";
    private byte[] hash;
    private boolean required;
    private String prompt;

    PackManager(DamageNumbersPlugin plugin) {
        this.plugin = plugin;
        reload();
    }

    void reload() {
        String nextUrl = plugin.getConfig().getString("resource-pack.url", "").trim();
        String nextHash = plugin.getConfig().getString("resource-pack.sha1", "").trim();
        required = plugin.getConfig().getBoolean("resource-pack.required", false);
        prompt = plugin.getConfig().getString("resource-pack.prompt", "Oranžová čísla poškození a MISS");
        if (nextUrl.isEmpty()) {
            url = "";
            hash = null;
            return;
        }
        try {
            URI uri = URI.create(nextUrl);
            if (!("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()))
                    || uri.getHost() == null || uri.getUserInfo() != null) {
                throw new IllegalArgumentException("Expected direct HTTP(S) URL without credentials");
            }
            if (!nextHash.matches("[0-9a-fA-F]{40}")) {
                throw new IllegalArgumentException("resource-pack.sha1 must have 40 hexadecimal characters");
            }
            byte[] next = HexFormat.of().parseHex(nextHash);
            if (!nextUrl.equals(url) || !java.util.Arrays.equals(hash, next)) loaded.clear();
            url = nextUrl;
            hash = next;
        } catch (IllegalArgumentException ex) {
            plugin.getLogger().warning("Automatic resource pack disabled: " + ex.getMessage());
            url = "";
            hash = null;
            loaded.clear();
        }
    }

    boolean hasFont(Player player) {
        return plugin.settings().assumeFont() || loaded.contains(player.getUniqueId());
    }

    boolean offer(Player player) {
        if (url.isEmpty() || !player.isOnline()) return false;
        player.addResourcePack(PACK_ID, url, hash.clone(), prompt, required);
        return true;
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        plugin.getServer().getScheduler().runTaskLater(plugin, () -> offer(event.getPlayer()), 20L);
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent event) {
        loaded.remove(event.getPlayer().getUniqueId());
    }

    @EventHandler
    public void onPackStatus(PlayerResourcePackStatusEvent event) {
        if (!PACK_ID.equals(event.getID())) return;
        switch (event.getStatus()) {
            case SUCCESSFULLY_LOADED -> loaded.add(event.getPlayer().getUniqueId());
            case DECLINED, FAILED_DOWNLOAD, INVALID_URL, FAILED_RELOAD, DISCARDED ->
                    loaded.remove(event.getPlayer().getUniqueId());
            default -> { }
        }
    }
}
