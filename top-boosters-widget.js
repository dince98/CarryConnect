// ============================================================
// TOP BOOSTERS WIDGET
// Shows top 3 rated + available boosters for the current game
// Auto-detects game from data-game-id attribute on #topBoostersWidget
// ============================================================

(function() {
    const SUPABASE_URL = 'https://aozhkwvoqnyktsgrdtnw.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvemhrd3ZvcW55a3RzZ3JkdG53Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjU2NTA1NiwiZXhwIjoyMDg4MTQxMDU2fQ.lbr0-PCymnj241Vwso6yJYzch7HOJ5utB-pPsWpkABc';
    
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    async function initTopBoostersWidget() {
        const container = document.getElementById('topBoostersWidget');
        if (!container) return;

        const gameId = container.dataset.gameId;
        const gameName = container.dataset.gameName || 'this game';
        if (!gameId) return;

        // 1. Fetch all boosters
        const { data: boosters, error } = await supabase
            .from('users')
            .select('user_id, username, avg_rating, total_ratings, specialty')
            .eq('role', 'booster');

        if (error) {
            console.error('Error fetching boosters:', error);
            container.innerHTML = '';
            return;
        }

        // Filter by specialty
        const qualifiedBoosters = (boosters || []).filter(b =>
            Array.isArray(b.specialty) && b.specialty.map(String).includes(String(gameId))
        );

        if (qualifiedBoosters.length === 0) {
            container.innerHTML = '';
            return;
        }

        // 2. Sort by rating desc → total_ratings desc → username
        qualifiedBoosters.sort((a, b) => {
            const ra = parseFloat(a.avg_rating) || 0;
            const rb = parseFloat(b.avg_rating) || 0;
            if (rb !== ra) return rb - ra;
            const ta = parseInt(a.total_ratings) || 0;
            const tb = parseInt(b.total_ratings) || 0;
            if (tb !== ta) return tb - ta;
            return (a.username || '').localeCompare(b.username || '');
        });

        // 3. Take top 3
        const top3 = qualifiedBoosters.slice(0, 3);
        const boosterIds = top3.map(b => b.user_id);

        // 4. Check who's busy (has in_progress order)
        const { data: busyOrders } = await supabase
            .from('orders')
            .select('booster_id')
            .in('booster_id', boosterIds)
            .eq('status', 'in_progress');

        const busyBoosterIds = new Set((busyOrders || []).map(o => o.booster_id));

        // 5. Render
        renderWidget(container, top3, busyBoosterIds, gameName);
    }

    function renderWidget(container, boosters, busySet, gameName) {
        const html = `
            <div class="top-boosters-wrapper">
                <div class="top-boosters-header">
                    <div class="top-boosters-title">
                        <i class="fas fa-crown"></i>
                        <span>Top Rated ${gameName} Boosters</span>
                    </div>
                    <div class="top-boosters-subtitle">
                        Request a specific top performer for your boost — or just order normally below
                    </div>
                </div>
                <div class="top-boosters-grid">
                    ${boosters.map((b, idx) => {
                        const isBusy = busySet.has(b.user_id);
                        const hasRating = b.avg_rating > 0;
                        const rating = hasRating ? parseFloat(b.avg_rating).toFixed(1) : 'New';
                        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
                        const initial = (b.username || 'B')[0].toUpperCase();
                        const safeName = String(b.username || '').replace(/'/g, "\\'");

                        return `
                            <div class="top-booster-card ${isBusy ? 'busy' : ''}" data-booster-id="${b.user_id}">
                                <div class="medal-badge">${medal}</div>
                                <div class="top-booster-avatar">${initial}</div>
                                <div class="top-booster-name">${b.username}</div>
                                <div class="top-booster-rating">
                                    ${hasRating 
                                        ? `<span class="mini-star">★</span> ${rating} <span class="mini-count">(${b.total_ratings})</span>` 
                                        : `<span class="mini-new">No ratings yet</span>`}
                                </div>
                                <div class="top-booster-status ${isBusy ? 'status-busy' : 'status-available'}">
                                    <i class="fas fa-${isBusy ? 'clock' : 'circle'}"></i>
                                    ${isBusy ? 'Currently Busy' : 'Available Now'}
                                </div>
                                ${isBusy 
                                    ? `<button class="btn-request-booster disabled" disabled>
                                        <i class="fas fa-ban"></i> Not Available
                                       </button>`
                                    : `<button class="btn-request-booster" onclick="requestBooster(${b.user_id}, '${safeName}', event)">
                                        <i class="fas fa-hand-paper"></i> Request ${b.username}
                                       </button>`
                                }
                            </div>
                        `;
                    }).join('')}
                </div>
                <div class="top-boosters-footer">
                    <i class="fas fa-info-circle"></i>
                    Don't want to wait? Just scroll down and place a normal order — we'll assign the next available booster.
                </div>
            </div>
        `;
        container.innerHTML = html;
    }

    // Global function: called when client clicks "Request This Booster"
    window.requestBooster = function(boosterId, boosterName, event) {
        sessionStorage.setItem('requestedBoosterId', boosterId);
        sessionStorage.setItem('requestedBoosterName', boosterName);

        showToast(`✓ ${boosterName} will be assigned to your order!`);

        document.querySelectorAll('.top-booster-card').forEach(c => c.classList.remove('picked'));
        event.target.closest('.top-booster-card')?.classList.add('picked');
    };

    function showToast(msg) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            padding: 15px 30px;
            border-radius: 50px;
            font-weight: 700;
            font-size: 15px;
            box-shadow: 0 15px 40px rgba(16,185,129,0.5);
            z-index: 99999;
            animation: slideUp 0.4s ease;
            display: flex;
            align-items: center;
            gap: 10px;
            font-family: 'Poppins', sans-serif;
        `;
        toast.innerHTML = `<i class="fas fa-check-circle"></i> ${msg}`;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideDown 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Auto-init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTopBoostersWidget);
    } else {
        initTopBoostersWidget();
    }
})();