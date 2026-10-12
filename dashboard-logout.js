import {
    onAuthStateChanged,
    signOut
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';

import {
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    where
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

import { auth, db } from './firebase-init.js';

let initialAuthStateResolved = false;
let unsubscribeAuthGuard = () => {};

const updateDashboardProfile = (user, profile = {}) => {
    const profileDisplayName =
        typeof profile.displayName === 'string'
            ? profile.displayName.trim()
            : '';

    const authDisplayName =
        typeof user.displayName === 'string'
            ? user.displayName.trim()
            : '';

    const displayName =
        profileDisplayName ||
        authDisplayName;

    const profileName =
        displayName ||
        'Savora Member';

    document
        .querySelectorAll('[data-auth-display-name]')
        .forEach((element) => {
            element.textContent = profileName;
        });

    document
        .querySelectorAll('[data-auth-greeting-name]')
        .forEach((element) => {
            element.textContent = displayName
                ? `, ${displayName}`
                : '';
        });

    const profileAvatar =
        document.querySelector(
            '.dashboard-topbar .user-avatar img'
        );

    if (profileAvatar && displayName) {
        profileAvatar.alt =
            `${displayName} profile avatar`;
    }

    if (
        typeof profile.membership === 'string' &&
        profile.membership.trim()
    ) {
        document
            .querySelectorAll('.membership-tier')
            .forEach((element) => {
                element.textContent =
                    profile.membership.trim();
            });
    }

    if (
        typeof profile.clubPoints === 'number' &&
        Number.isFinite(profile.clubPoints)
    ) {
        const pointsValue =
            document.querySelector('#rewards .card-value');

        const pointsText =
            pointsValue &&
            Array.from(pointsValue.childNodes).find(
                (node) => node.nodeType === Node.TEXT_NODE
            );

        if (pointsText) {
            pointsText.nodeValue =
                `${profile.clubPoints.toLocaleString()} `;
        }
    }
};

const loadDashboardProfile = async (user) => {
    updateDashboardProfile(user);

    try {
        const profileSnapshot =
            await getDoc(
                doc(db, 'users', user.uid)
            );

        if (profileSnapshot.exists()) {
            updateDashboardProfile(
                user,
                profileSnapshot.data()
            );
        }
    } catch {
        // Keep the authenticated dashboard usable
        // with its existing fallback values.
    }
};

const historyBody = document.querySelector('#customer-history-body');
const historyStatus = document.querySelector('#dashboard-history-status');
const historyCurrency = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
});

const formatRecordDate = (value) => {
    if (value && typeof value.toDate === 'function') {
        return value.toDate().toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short'
        });
    }

    return 'Date unavailable';
};

const formatReservationDate = (value) => {
    if (typeof value !== 'string') {
        return 'Date unavailable';
    }

    const [year, month, day] = value.split('-').map(Number);

    if (!year || !month || !day) {
        return value;
    }

    return new Date(year, month - 1, day).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};

const appendHistoryRow = (values) => {
    const row = document.createElement('tr');

    [values.type, values.dateTime, values.details, values.total].forEach((value) => {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.append(cell);
    });

    const recordCell = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = 'badge confirmed';
    badge.textContent = 'Saved';
    recordCell.append(badge);
    row.append(recordCell);
    historyBody.append(row);
};

const appendHistoryMessage = (message) => {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 5;
    cell.textContent = message;
    row.append(cell);
    historyBody.append(row);
};

const getRecordTimestamp = (record) => {
    if (record?.createdAt && typeof record.createdAt.toMillis === 'function') {
        return record.createdAt.toMillis();
    }

    if (record?.createdAt && typeof record.createdAt.toDate === 'function') {
        return record.createdAt.toDate().getTime();
    }

    return 0;
};

const loadRecentRecords = async (collectionName, userId) => {
    const records = collection(db, collectionName);

    try {
        return await getDocs(query(
            records,
            where('userId', '==', userId),
            orderBy('createdAt', 'desc'),
            limit(5)
        ));
    } catch (error) {
        const errorCode = typeof error?.code === 'string'
            ? error.code
            : 'unknown';
        const errorMessage = typeof error?.message === 'string'
            ? error.message
            : 'No error message was provided.';

        console.error(`Dashboard ${collectionName} history query failed.`, {
            code: errorCode,
            message: errorMessage
        });

        const requiresIndex = errorCode === 'failed-precondition'
            && /requires an? index|composite index/i.test(errorMessage);

        if (!requiresIndex) {
            throw error;
        }

        console.warn(
            `Dashboard ${collectionName} history is using an owner-scoped index fallback. Create the composite index for userId ascending and createdAt descending.`,
            { code: errorCode }
        );

        let ownerSnapshot;

        try {
            ownerSnapshot = await getDocs(query(
                records,
                where('userId', '==', userId)
            ));
        } catch (fallbackError) {
            console.error(`Dashboard ${collectionName} owner-scoped fallback failed.`, {
                code: typeof fallbackError?.code === 'string'
                    ? fallbackError.code
                    : 'unknown',
                message: typeof fallbackError?.message === 'string'
                    ? fallbackError.message
                    : 'No error message was provided.'
            });
            throw fallbackError;
        }
        const newestFive = [...ownerSnapshot.docs]
            .sort((left, right) =>
                getRecordTimestamp(right.data()) - getRecordTimestamp(left.data())
            )
            .slice(0, 5);

        return { docs: newestFive };
    }
};

const loadDashboardHistory = async (user) => {
    if (!historyBody || !historyStatus) {
        return;
    }

    const [reservationResult, orderResult] = await Promise.allSettled([
        loadRecentRecords('reservations', user.uid),
        loadRecentRecords('orders', user.uid)
    ]);

    historyBody.replaceChildren();
    let hasErrors = false;

    const reservationRecords = reservationResult.status === 'fulfilled'
        ? reservationResult.value.docs.map((snapshot) => snapshot.data())
        : null;
    const orderRecords = orderResult.status === 'fulfilled'
        ? orderResult.value.docs.map((snapshot) => snapshot.data())
        : null;

    if (!reservationRecords) {
        hasErrors = true;
        appendHistoryMessage('Recent reservations could not be loaded.');
    } else if (!reservationRecords.length) {
        appendHistoryMessage('No recent reservations yet.');
    }

    if (!orderRecords) {
        hasErrors = true;
        appendHistoryMessage('Recent orders could not be loaded.');
    } else if (!orderRecords.length) {
        appendHistoryMessage('No recent orders yet.');
    }

    const records = [
        ...(reservationRecords || []).map((record) => ({
            kind: 'reservation',
            record,
            sortTime: record.createdAt && typeof record.createdAt.toDate === 'function'
                ? record.createdAt.toDate().getTime()
                : 0
        })),
        ...(orderRecords || []).map((record) => ({
            kind: 'order',
            record,
            sortTime: record.createdAt && typeof record.createdAt.toDate === 'function'
                ? record.createdAt.toDate().getTime()
                : 0
        }))
    ].sort((left, right) => right.sortTime - left.sortTime);

    records.forEach(({ kind, record }) => {
        if (kind === 'reservation') {
            const date = formatReservationDate(record.date);
            const time = typeof record.time === 'string' ? record.time : '';
            const guests = typeof record.guests === 'string' || typeof record.guests === 'number'
                ? `${record.guests} guest${Number(record.guests) === 1 ? '' : 's'}`
                : 'Guest count unavailable';

            appendHistoryRow({
                type: 'Reservation',
                dateTime: time ? `${date} · ${time}` : date,
                details: guests,
                total: '—'
            });
            return;
        }

        const items = Array.isArray(record.items)
            ? record.items.map((item) => {
                const dish = typeof item.dish === 'string' ? item.dish : 'Item';
                const quantity = Number.isInteger(item.quantity)
                    ? ` × ${item.quantity}`
                    : '';
                return `${dish}${quantity}`;
            }).join(', ')
            : 'Order details unavailable';
        const orderType = typeof record.orderType === 'string'
            ? record.orderType
            : 'Order';
        const total = typeof record.total === 'number' && Number.isFinite(record.total)
            ? historyCurrency.format(record.total)
            : '—';

        appendHistoryRow({
            type: 'Order',
            dateTime: formatRecordDate(record.createdAt),
            details: `${orderType} · ${items}`,
            total
        });
    });

    historyStatus.textContent = hasErrors
        ? 'Some recent activity could not be loaded. Please try again later.'
        : '';
};

unsubscribeAuthGuard = onAuthStateChanged(
    auth,
    async (user) => {
        if (initialAuthStateResolved) {
            return;
        }

        initialAuthStateResolved = true;
        unsubscribeAuthGuard();

        if (!user) {
            window.location.replace('login.html');
            return;
        }

        loadDashboardProfile(user);
        loadDashboardHistory(user);
    }
);

const logoutLinks =
    document.querySelectorAll(
        '.sidebar-logout, .logout-btn'
    );

const logoutStatus =
    document.querySelector(
        '.dashboard-logout-status'
    );

let isSigningOut = false;

logoutLinks.forEach((link) => {
    link.addEventListener('click', async (event) => {
        event.preventDefault();

        if (isSigningOut) {
            return;
        }

        isSigningOut = true;

        logoutLinks.forEach((logoutLink) => {
            logoutLink.setAttribute(
                'aria-disabled',
                'true'
            );
        });

        logoutStatus.classList.remove('is-error');
        logoutStatus.textContent =
            'Signing you out...';

        try {
            await signOut(auth);
            window.location.assign('login.html');
        } catch {
            logoutStatus.classList.add('is-error');
            logoutStatus.textContent =
                'We couldn’t sign you out. Please try again.';

            logoutLinks.forEach((logoutLink) => {
                logoutLink.removeAttribute(
                    'aria-disabled'
                );
            });

            isSigningOut = false;
        }
    });
});
