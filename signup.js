import {
    createUserWithEmailAndPassword,
    updateProfile
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';

import {
    doc,
    serverTimestamp,
    setDoc
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

import { auth, db } from './firebase-init.js';

const EMAILJS_PUBLIC_KEY = 'N5ibvkUllGFKxPcAM';
const EMAILJS_SERVICE_ID = 'service_5utk5zs';
const EMAILJS_WELCOME_TEMPLATE_ID = 'template_mend9jq';

const sendWelcomeEmail = async (name, email) => {
    const emailjs = await import(
        'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/+esm'
    );

    emailjs.init({
        publicKey: EMAILJS_PUBLIC_KEY
    });

    await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_WELCOME_TEMPLATE_ID,
        { name, email }
    );
};

const signupForm = document.querySelector('.signup-form');

if (signupForm) {
    const nameInput = signupForm.querySelector('#fullname');
    const emailInput = signupForm.querySelector('#email');
    const passwordInput = signupForm.querySelector('#password');
    const confirmPasswordInput = signupForm.querySelector('#confirm-password');
    const submitButton = signupForm.querySelector('button[type="submit"]');
    const statusMessage = signupForm.querySelector('.signup-status');
    const successState = document.querySelector('.signup-success');
    const formHeading = document.querySelector('.form-header h2');
    const formSubtitle = document.querySelector('.form-header .auth-subtitle');
    const originalButtonText = submitButton.textContent;

    const getFriendlyError = (error) => {
        switch (error.code) {
            case 'auth/email-already-in-use':
                return 'An account already exists for this email. Please log in instead.';

            case 'auth/invalid-email':
                return 'Please enter a valid email address.';

            case 'auth/weak-password':
                return 'Choose a stronger password with at least 6 characters.';

            case 'auth/operation-not-allowed':
                return 'Email sign up is temporarily unavailable. Please try again later.';

            case 'auth/network-request-failed':
                return 'We couldn’t connect. Check your internet connection and try again.';

            case 'auth/too-many-requests':
                return 'There have been too many attempts. Please wait a little and try again.';

            default:
                return 'We couldn’t create your account right now. Please try again.';
        }
    };

    const showSuccess = (message) => {
        formHeading.textContent = 'Account Created';

        formSubtitle.textContent =
            'Your Savora Kitchen account is ready to use.';

        successState.querySelector('p').textContent = message;

        signupForm.hidden = true;
        successState.hidden = false;
        successState.focus();
    };

    signupForm.addEventListener('input', () => {
        if (statusMessage.classList.contains('is-error')) {
            statusMessage.textContent = '';
            statusMessage.classList.remove('is-error');
        }
    });

    signupForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (signupForm.dataset.submitting === 'true') {
            return;
        }

        const displayName = nameInput.value.trim();

        if (!displayName) {
            statusMessage.textContent = 'Please enter your full name.';
            statusMessage.classList.add('is-error');
            nameInput.focus();
            return;
        }

        if (passwordInput.value !== confirmPasswordInput.value) {
            statusMessage.textContent =
                'Your passwords don’t match. Please check both fields.';

            statusMessage.classList.add('is-error');
            confirmPasswordInput.focus();
            return;
        }

        signupForm.dataset.submitting = 'true';
        signupForm.setAttribute('aria-busy', 'true');
        submitButton.disabled = true;
        submitButton.textContent = 'Creating Account...';

        statusMessage.classList.remove('is-error');
        statusMessage.textContent = 'Creating your Savora account...';

        let accountCreated = false;

        try {
            const credential = await createUserWithEmailAndPassword(
                auth,
                emailInput.value.trim(),
                passwordInput.value
            );

            accountCreated = true;

            await updateProfile(credential.user, {
                displayName
            });

            await setDoc(doc(db, 'users', credential.user.uid), {
                displayName,
                email: credential.user.email,
                avatarId: 'savora-01',
                membership: 'Standard',
                clubPoints: 0,
                createdAt: serverTimestamp(),
                preferences: {}
            });

            let welcomeEmailSent = false;

            try {
                await sendWelcomeEmail(displayName, emailInput.value.trim());
                welcomeEmailSent = true;
            } catch (error) {
                console.error(
                    'Account creation succeeded, but the welcome email could not be sent.',
                    error
                );
            }

            showSuccess(welcomeEmailSent
                ? 'Your Savora account has been created successfully and is ready to use. A welcome email has been sent.'
                : 'Your Savora account has been created successfully and is ready to use.'
            );
        } catch (error) {
            console.error('Signup error:', error);

            if (accountCreated) {
                showSuccess(
                    'Your account was created, but we couldn’t finish setting up your profile. It is ready to use; continue to the login page.'
                );
            } else {
                statusMessage.textContent = getFriendlyError(error);
                statusMessage.classList.add('is-error');
            }
        } finally {
            signupForm.removeAttribute('aria-busy');
            delete signupForm.dataset.submitting;

            if (!accountCreated) {
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
            }
        }
    });

    statusMessage.textContent = '';
    submitButton.disabled = false;
}
