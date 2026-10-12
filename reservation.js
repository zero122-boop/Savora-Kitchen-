const reservationForm = document.querySelector('.reservation-form');

const EMAILJS_PUBLIC_KEY = 'N5ibvkUllGFKxPcAM';
const EMAILJS_SERVICE_ID = 'service_5utk5zs';
const EMAILJS_TEMPLATE_ID = 'template_6nx22oa';

const saveAuthenticatedReservation = async (formData) => {
    const [authSdk, firestoreSdk, firebase] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js'),
        import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js'),
        import('./firebase-init.js')
    ]);

    const { onAuthStateChanged } = authSdk;
    const { addDoc, collection, serverTimestamp } = firestoreSdk;
    const { auth, db } = firebase;

    const currentUser = await new Promise((resolve) => {
        let unsubscribe = () => {};

        unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe();
            resolve(user);
        });
    });

    if (!currentUser) {
        return { status: 'not-signed-in' };
    }

    await addDoc(collection(db, 'reservations'), {
        name: formData.get('name'),
        email: formData.get('email'),
        date: formData.get('date'),
        time: formData.get('time'),
        guests: formData.get('guests'),
        userId: currentUser.uid,
        createdAt: serverTimestamp()
    });

    return { status: 'saved' };
};

const sendCustomerConfirmation = async (reservation) => {
    const emailjs = await import(
        'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/+esm'
    );

    emailjs.init({
        publicKey: EMAILJS_PUBLIC_KEY
    });

    await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
            email_subject: 'Savora Kitchen | Reservation Details',
            email_heading: 'Reservation Received',
            email_message:
                `Thank you, ${reservation.name}. We look forward to welcoming you.`,
            details_text: [
                `Date: ${reservation.date}`,
                `Time: ${reservation.time}`,
                `Guests: ${reservation.guests}`
            ].join('\n'),
            name: reservation.name,
            email: reservation.email
        }
    );
};

if (reservationForm) {
    reservationForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (reservationForm.dataset.submitting === 'true') {
            return;
        }

        const submitButton = reservationForm.querySelector('.submit-btn');
        const statusMessage = reservationForm.querySelector('.reservation-form-status');
        const originalButtonText = submitButton.textContent;
        const formData = new FormData(reservationForm);

        reservationForm.dataset.submitting = 'true';
        submitButton.disabled = true;
        submitButton.textContent = 'Sending reservation...';
        reservationForm.setAttribute('aria-busy', 'true');

        statusMessage.classList.remove('is-error');
        statusMessage.textContent = 'Sending your reservation request...';

        try {
            const response = await fetch(reservationForm.action, {
                method: 'POST',
                body: formData,
                headers: {
                    Accept: 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Reservation submission failed.');
            }
        } catch {
            statusMessage.classList.add('is-error');
            statusMessage.textContent =
                'We couldn’t send your reservation right now. Please try again.';

            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
            reservationForm.removeAttribute('aria-busy');
            delete reservationForm.dataset.submitting;

            return;
        }

        let reservationSaveState = 'saving';
        let reservationSaveStatus;
        const updateReservationSaveStatus = () => {
            if (!reservationSaveStatus) {
                return;
            }

            if (reservationSaveState === 'saved') {
                reservationSaveStatus.textContent =
                    'This reservation was also saved to your Savora account history.';
            } else if (reservationSaveState === 'not-signed-in') {
                reservationSaveStatus.textContent =
                    'Your reservation was received. Sign in to save reservations to your account history.';
            } else if (reservationSaveState === 'failed') {
                reservationSaveStatus.textContent =
                    'Your reservation was received, but it could not be saved to your account history.';
            } else {
                reservationSaveStatus.textContent =
                    'Saving this reservation to your Savora account history...';
            }
        };
        const reservationSavePromise = saveAuthenticatedReservation(formData)
            .then((result) => {
                reservationSaveState = result.status;
                updateReservationSaveStatus();
            })
            .catch((error) => {
                reservationSaveState = 'failed';
                console.error(
                    'The Formspree reservation succeeded, but its Firestore copy could not be saved.',
                    error
                );
                updateReservationSaveStatus();
            });

        const [year, month, day] = formData.get('date').split('-').map(Number);

        const reservation = {
            name: formData.get('name'),
            email: formData.get('email'),
            date: new Date(year, month - 1, day).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }),
            time: formData.get('time'),
            guests: reservationForm.querySelector('#guests').selectedOptions[0].textContent
        };

        let customerEmailSent = false;

        try {
            await sendCustomerConfirmation(reservation);
            customerEmailSent = true;
        } catch (error) {
            console.error(
                'Reservation succeeded, but the customer confirmation email could not be sent.',
                error
            );
        }

        const confirmation = document.createElement('div');
        confirmation.className = 'reservation-confirmation';
        confirmation.setAttribute('role', 'status');

        const indicator = document.createElement('div');
        indicator.className = 'reservation-confirmation-icon';
        indicator.setAttribute('aria-hidden', 'true');
        indicator.textContent = '✓';

        const heading = document.createElement('h2');
        heading.textContent = 'Reservation Received';
        heading.setAttribute('tabindex', '-1');

        const thankYou = document.createElement('p');
        thankYou.className = 'reservation-confirmation-thanks';
        thankYou.textContent =
            `Thank you, ${reservation.name}. We look forward to welcoming you.`;

        const details = document.createElement('dl');
        details.className = 'reservation-confirmation-details';

        [
            ['Date', reservation.date],
            ['Time', reservation.time],
            ['Guests', reservation.guests]
        ].forEach(([label, value]) => {
            const detail = document.createElement('div');

            const term = document.createElement('dt');
            term.textContent = label;

            const description = document.createElement('dd');
            description.textContent = value;

            detail.append(term, description);
            details.append(detail);
        });

        const emailNotice = document.createElement('p');
        emailNotice.className = 'reservation-confirmation-email';

        if (customerEmailSent) {
            emailNotice.textContent =
                `A confirmation has been sent to ${reservation.email}.`;
        } else {
            emailNotice.textContent =
                'Your reservation was received successfully. We could not send the email confirmation right now.';
        }

        reservationSaveStatus = document.createElement('p');
        reservationSaveStatus.className = 'reservation-confirmation-email';
        updateReservationSaveStatus();

        const homeLink = document.createElement('a');
        homeLink.className = 'reservation-home-link';
        homeLink.href = 'index.html';
        homeLink.textContent = 'Back to Home';

        confirmation.append(
            indicator,
            heading,
            thankYou,
            details,
            emailNotice,
            reservationSaveStatus,
            homeLink
        );

        reservationForm
            .closest('.reservation-form-wrapper')
            .replaceChildren(confirmation);

        heading.focus();
        void reservationSavePromise;
    });
}
