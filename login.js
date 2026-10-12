import { signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';

import { auth } from './firebase-init.js';

const loginForm = document.querySelector('.login-form');

if (loginForm) {
    const emailInput = loginForm.querySelector('#email');
    const passwordInput = loginForm.querySelector('#password');
    const submitButton = loginForm.querySelector('button[type="submit"]');
    const statusMessage = loginForm.querySelector('.login-status');
    const originalButtonText = submitButton.textContent;

    const getFriendlyError = (error) => {
        switch (error.code) {
            case 'auth/invalid-credential':
            case 'auth/invalid-login-credentials':
            case 'auth/wrong-password':
            case 'auth/user-not-found':
                return 'Email or password is incorrect. Please try again.';

            case 'auth/invalid-email':
                return 'Please enter a valid email address.';

            case 'auth/user-disabled':
                return 'This account is unavailable. Please contact Savora support.';

            case 'auth/too-many-requests':
                return 'There have been too many attempts. Please wait a little and try again.';

            case 'auth/network-request-failed':
                return 'We couldn’t connect. Check your internet connection and try again.';

            case 'auth/operation-not-allowed':
                return 'Email and password sign in is temporarily unavailable. Please try again later.';

            default:
                return 'We couldn’t sign you in right now. Please try again.';
        }
    };

    loginForm.addEventListener('input', () => {
        if (statusMessage.classList.contains('is-error')) {
            statusMessage.textContent = '';
            statusMessage.classList.remove('is-error');
        }
    });

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (loginForm.dataset.submitting === 'true') {
            return;
        }

        loginForm.dataset.submitting = 'true';
        loginForm.setAttribute('aria-busy', 'true');
        submitButton.disabled = true;
        submitButton.textContent = 'Signing In...';

        statusMessage.classList.remove('is-error');
        statusMessage.textContent = 'Checking your account...';

        let authenticated = false;

        try {
            await signInWithEmailAndPassword(
                auth,
                emailInput.value.trim(),
                passwordInput.value
            );

            authenticated = true;
            window.location.assign('dashboard.html');

        } catch (error) {
            statusMessage.textContent = getFriendlyError(error);
            statusMessage.classList.add('is-error');

        } finally {
            loginForm.removeAttribute('aria-busy');
            delete loginForm.dataset.submitting;

            if (!authenticated) {
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
            }
        }
    });
}
