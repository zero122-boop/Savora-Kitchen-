document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('header, .navbar');
    const menuToggle = document.querySelector('.mobile-menu-toggle');
    const menuLinks = document.querySelectorAll('.nav-links a, .nav-actions a');
    const sections = document.querySelectorAll(
        'main section:not(.hero), .about-hero, .our-story, .kitchen-environment, .our-chefs, .about-cta, .contact-hero, .reservation-section, .contact-info-section'
    );
    const menuCategories = document.querySelectorAll('.menu-category');
    const statsSection = document.querySelector('.about-stats');
    const counters = document.querySelectorAll('.about-stats [data-count]');
    const orderForm = document.querySelector('.order-form');
    const deliveryOption = document.querySelector('#delivery');
    const pickupOption = document.querySelector('#pickup');
    const deliveryAddress = document.querySelector('#delivery-address');

    const closeMobileMenu = () => {
        if (!header || !menuToggle) {
            return;
        }

        header.classList.remove('menu-open');
        menuToggle.setAttribute('aria-expanded', 'false');
    };

    if (header && menuToggle) {
        menuToggle.addEventListener('click', () => {
            const isOpen = header.classList.toggle('menu-open');
            menuToggle.setAttribute('aria-expanded', String(isOpen));
        });

        menuLinks.forEach((link) => link.addEventListener('click', closeMobileMenu));
        window.addEventListener('resize', () => {
            if (window.innerWidth >= 768) {
                closeMobileMenu();
            }
        });
    }

    if (orderForm && deliveryOption && pickupOption && deliveryAddress) {
        const syncOrderFields = () => {
            deliveryAddress.required = deliveryOption.checked;
            deliveryAddress.disabled = pickupOption.checked;
        };

        deliveryOption.addEventListener('change', syncOrderFields);
        pickupOption.addEventListener('change', syncOrderFields);
        syncOrderFields();

        const dishSelect = orderForm.querySelector('#food-selection');
        const quantityInput = orderForm.querySelector('#order-qty');
        const emailInput = orderForm.querySelector('#order-email');
        const nameInput = orderForm.querySelector('#order-name');
        const pickupTimeInput = orderForm.querySelector('#pickup-time');
        const submitButton = orderForm.querySelector('.submit-btn');
        const orderStatus = orderForm.querySelector('.order-status');
        const pricePreview = orderForm.querySelector('#order-price-preview');
        const priceLine = pricePreview.querySelector('.order-price-line');
        const priceTotal = pricePreview.querySelector('.order-price-total');
        const currency = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        });
        const ORDER_EMAILJS_PUBLIC_KEY = 'N5ibvkUllGFKxPcAM';
        const ORDER_EMAILJS_SERVICE_ID = 'service_5utk5zs';
        const ORDER_EMAILJS_TEMPLATE_ID = 'template_6nx22oa';
        let isSubmittingOrder = false;

        const sendOrderConfirmation = async (order) => {
            const emailjs = await import(
                'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/+esm'
            );

            emailjs.init({
                publicKey: ORDER_EMAILJS_PUBLIC_KEY
            });

            const itemDetails = order.items.flatMap((item) => [
                `Dish: ${item.dish}`,
                `Quantity: ${item.quantity}`,
                `Unit price: ${currency.format(item.unitPrice)}`,
                `Subtotal: ${currency.format(item.subtotal)}`
            ]);
            const details = [
                `Order type: ${order.orderType}`,
                ...itemDetails,
                `Order total: ${currency.format(order.total)}`
            ];

            if (order.deliveryAddress) {
                details.push(`Delivery address: ${order.deliveryAddress}`);
            }

            if (order.pickupTime) {
                details.push(`Pickup time: ${order.pickupTime}`);
            }

            await emailjs.send(
                ORDER_EMAILJS_SERVICE_ID,
                ORDER_EMAILJS_TEMPLATE_ID,
                {
                    email_subject: 'Savora Kitchen | Your Order Details',
                    email_heading: 'Your Order Has Been Placed!',
                    email_message:
                        `Thank you for choosing Savora Kitchen, ${order.customerName}. Your order details are below.`,
                    details_text: details.join('\n'),
                    name: order.customerName,
                    email: order.customerEmail
                }
            );
        };

        const saveOrderForCurrentUser = async (order) => {
            const [authSdk, firestoreSdk, firebase] = await Promise.all([
                import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js'),
                import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js'),
                import('./firebase-init.js')
            ]);

            const { onAuthStateChanged } = authSdk;
            const { addDoc, collection, serverTimestamp } = firestoreSdk;
            const { auth, db } = firebase;

            const currentUser = await new Promise((resolve) => {
                let resolved = false;
                let unsubscribe = () => {};

                const resolveOnce = (user) => {
                    if (resolved) {
                        return;
                    }

                    resolved = true;
                    unsubscribe();
                    resolve(user);
                };

                const stopListening = onAuthStateChanged(auth, resolveOnce);
                unsubscribe = stopListening;

                if (resolved) {
                    unsubscribe();
                }
            });

            if (!currentUser) {
                return false;
            }

            await addDoc(collection(db, 'orders'), {
                customerName: order.customerName,
                customerEmail: order.customerEmail,
                orderType: order.orderType,
                items: order.items.map((item) => ({
                    dish: item.dish,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    subtotal: item.subtotal
                })),
                total: order.total,
                deliveryAddress: order.deliveryAddress,
                pickupTime: order.pickupTime,
                userId: currentUser.uid,
                createdAt: serverTimestamp()
            });

            return true;
        };

        const loadMenuPrices = async () => {
            const response = await fetch('menu.html');

            if (!response.ok) {
                throw new Error('Menu pricing is unavailable.');
            }

            const menuDocument = new DOMParser().parseFromString(
                await response.text(),
                'text/html'
            );
            const prices = new Map();

            menuDocument.querySelectorAll('.food-slider').forEach((item) => {
                const name = item.querySelector('.food-info h3')?.textContent.trim();
                const priceText = item.querySelector('.food-price span')?.textContent.trim();
                const numericPrice = priceText
                    ? Number(priceText.replace(/[^0-9.]/g, ''))
                    : NaN;

                if (name && Number.isFinite(numericPrice) && numericPrice >= 0) {
                    prices.set(name, numericPrice);
                }
            });

            if (!prices.size) {
                throw new Error('Menu pricing is unavailable.');
            }

            return prices;
        };

        const menuPrices = loadMenuPrices().catch(() => null);

        const showOrderError = (message) => {
            orderStatus.textContent = message;
            orderStatus.classList.add('is-error');
        };

        const getSelectedPrice = async () => {
            const prices = await menuPrices;
            return prices?.get(dishSelect.value);
        };

        const updatePricePreview = async () => {
            if (!dishSelect.value) {
                pricePreview.hidden = true;
                return;
            }

            const quantity = Number(quantityInput.value);

            if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
                pricePreview.hidden = false;
                priceLine.textContent = 'Choose a whole-number quantity from 1 to 10.';
                priceTotal.textContent = '';
                return;
            }

            const unitPrice = await getSelectedPrice();

            if (!Number.isFinite(unitPrice)) {
                pricePreview.hidden = true;
                showOrderError(
                    'We couldn’t load the current menu price. Please try again later.'
                );
                return;
            }

            const subtotal = unitPrice * quantity;
            pricePreview.hidden = false;
            priceLine.textContent =
                `${dishSelect.value}: ${quantity} × ${currency.format(unitPrice)} = ${currency.format(subtotal)}`;
            priceTotal.textContent = `Order total: ${currency.format(subtotal)}`;
            orderStatus.textContent = '';
            orderStatus.classList.remove('is-error');
        };

        dishSelect.addEventListener('change', updatePricePreview);
        quantityInput.addEventListener('input', () => {
            quantityInput.setCustomValidity('');
            updatePricePreview();
        });

        const appendDetail = (list, label, value) => {
            const row = document.createElement('div');
            const term = document.createElement('dt');
            const description = document.createElement('dd');
            term.textContent = label;
            description.textContent = value;
            row.append(term, description);
            list.append(row);
        };

        const showOrderConfirmation = (order, orderSaveStatus, emailSent) => {
            const confirmation = document.createElement('section');
            confirmation.className = 'order-confirmation';
            confirmation.setAttribute('role', 'status');
            confirmation.setAttribute('aria-labelledby', 'order-confirmation-title');

            const kicker = document.createElement('span');
            kicker.className = 'brand-tag';
            kicker.textContent = 'Savora Direct';

            const heading = document.createElement('h2');
            heading.id = 'order-confirmation-title';
            heading.tabIndex = -1;
            heading.textContent = 'Your Order Has Been Placed!';

            const message = document.createElement('p');
            message.className = 'order-confirmation-message';
            message.textContent =
                `Thank you for choosing Savora Kitchen, ${order.customerName}. Review your order details below.`;

            const saveStatus = document.createElement('p');
            saveStatus.className = 'order-confirmation-message';

            if (orderSaveStatus === 'saved') {
                saveStatus.textContent =
                    'This order has been saved to your Savora account history.';
            } else if (orderSaveStatus === 'not-signed-in') {
                saveStatus.textContent =
                    'You were not signed in, so this order was not added to an account history.';
            } else {
                saveStatus.textContent =
                    'We couldn’t save this order to your account history. Please contact Savora if you need help.';
            }

            const emailStatus = document.createElement('p');
            emailStatus.className = 'order-confirmation-message';
            emailStatus.textContent = emailSent
                ? `The order email was sent to ${order.customerEmail}. Please check your inbox.`
                : `We couldn’t send the order email to ${order.customerEmail} right now. Your order details are shown below.`;

            const details = document.createElement('dl');
            details.className = 'order-confirmation-details';
            appendDetail(details, 'Full Name', order.customerName);
            appendDetail(details, 'Email Address', order.customerEmail);
            appendDetail(details, 'Order Type', order.orderType);

            const itemsHeading = document.createElement('h3');
            itemsHeading.textContent = 'Order Summary';

            const itemsList = document.createElement('ul');
            itemsList.className = 'order-confirmation-items';

            order.items.forEach((item) => {
                const row = document.createElement('li');
                const name = document.createElement('strong');
                const pricing = document.createElement('span');
                const subtotal = document.createElement('span');
                name.textContent = item.dish;
                pricing.textContent =
                    `${item.quantity} × ${currency.format(item.unitPrice)}`;
                subtotal.textContent = currency.format(item.subtotal);
                row.append(name, pricing, subtotal);
                itemsList.append(row);
            });

            const total = document.createElement('p');
            total.className = 'order-confirmation-total';
            total.textContent = `Order total: ${currency.format(order.total)}`;

            if (order.deliveryAddress) {
                appendDetail(details, 'Delivery Address', order.deliveryAddress);
            }

            if (order.pickupTime) {
                appendDetail(details, 'Pickup Time', order.pickupTime);
            }

            const menuLink = document.createElement('a');
            menuLink.className = 'submit-btn order-menu-link';
            menuLink.href = 'menu.html';
            menuLink.textContent = 'Continue Browsing the Menu';

            confirmation.append(
                kicker,
                heading,
                message,
                saveStatus,
                emailStatus,
                details,
                itemsHeading,
                itemsList,
                total,
                menuLink
            );

            orderForm.replaceWith(confirmation);
            heading.focus();
        };

        orderForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            if (isSubmittingOrder) {
                return;
            }

            nameInput.setCustomValidity(
                !nameInput.value.trim()
                    ? 'Enter your full name.'
                    : nameInput.value.length > 200
                        ? 'Your name must be 200 characters or fewer.'
                        : ''
            );
            emailInput.setCustomValidity(
                emailInput.value.length > 254
                    ? 'Your email must be 254 characters or fewer.'
                    : ''
            );
            deliveryAddress.setCustomValidity(
                !deliveryOption.checked
                    ? ''
                    : !deliveryAddress.value.trim()
                        ? 'Enter a delivery address.'
                        : deliveryAddress.value.length > 500
                            ? 'Your delivery address must be 500 characters or fewer.'
                            : ''
            );
            quantityInput.setCustomValidity('');

            if (!orderForm.reportValidity()) {
                return;
            }

            const quantity = Number(quantityInput.value);

            if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
                quantityInput.setCustomValidity('Enter a whole number from 1 to 10.');
                quantityInput.reportValidity();
                return;
            }

            quantityInput.setCustomValidity('');
            isSubmittingOrder = true;
            submitButton.disabled = true;
            submitButton.textContent = 'Preparing Order...';
            orderForm.setAttribute('aria-busy', 'true');
            orderStatus.textContent = 'Preparing your order summary...';
            orderStatus.classList.remove('is-error');

            try {
                const unitPrice = await getSelectedPrice();

                if (!Number.isFinite(unitPrice)) {
                    throw new Error('Menu pricing is unavailable.');
                }

                const orderType = pickupOption.checked ? 'Pickup' : 'Delivery';
                const subtotal = unitPrice * quantity;
                const order = {
                    customerName: nameInput.value.trim(),
                    customerEmail: emailInput.value.trim(),
                    orderType,
                    items: [{
                        dish: dishSelect.value,
                        quantity,
                        unitPrice,
                        subtotal
                    }],
                    total: subtotal,
                    deliveryAddress: deliveryOption.checked
                        ? deliveryAddress.value.trim()
                        : '',
                    pickupTime: pickupOption.checked
                        ? pickupTimeInput.value
                        : ''
                };

                const [saveResult, emailResult] = await Promise.allSettled([
                    saveOrderForCurrentUser(order),
                    sendOrderConfirmation(order)
                ]);

                if (saveResult.status === 'rejected') {
                    console.error(
                        'The order email flow completed, but the order could not be saved to Firestore.',
                        saveResult.reason
                    );
                }

                if (emailResult.status === 'rejected') {
                    console.error(
                        'The order was processed, but its confirmation email could not be sent.',
                        emailResult.reason
                    );
                }

                const orderSaveStatus = saveResult.status === 'fulfilled'
                    ? saveResult.value ? 'saved' : 'not-signed-in'
                    : 'failed';

                showOrderConfirmation(
                    order,
                    orderSaveStatus,
                    emailResult.status === 'fulfilled'
                );
            } catch {
                showOrderError(
                    'We couldn’t load the current menu price. Your order summary is not available right now. Please try again later.'
                );
                submitButton.disabled = false;
                submitButton.textContent = 'Place Order';
                orderForm.removeAttribute('aria-busy');
                isSubmittingOrder = false;
            }
        });
    }

    const showFinalValues = () => {
        counters.forEach((counter) => {
            counter.textContent = `${counter.dataset.count}${counter.dataset.suffix || ''}`;
        });
    };

    const showSections = () => {
        sections.forEach((section) => section.classList.add('is-visible'));
    };

    const showMenuCategories = () => {
        menuCategories.forEach((category) => category.classList.add('is-visible'));
    };

    sections.forEach((section) => section.classList.add('reveal-on-scroll'));

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        showSections();
        showMenuCategories();
        showFinalValues();
        return;
    }

    if ('IntersectionObserver' in window) {
        const sectionObserver = new IntersectionObserver((entries, currentObserver) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    currentObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15 });

        sections.forEach((section) => sectionObserver.observe(section));

        const menuObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                entry.target.classList.toggle('is-visible', entry.isIntersecting);
            });
        }, { threshold: 0.15 });

        menuCategories.forEach((category) => menuObserver.observe(category));
    } else {
        showSections();
        showMenuCategories();
    }

    if (!statsSection || !counters.length) {
        return;
    }

    const animateCounters = () => {
        const duration = 1200;
        const startTime = performance.now();

        const updateCounters = (currentTime) => {
            const progress = Math.min((currentTime - startTime) / duration, 1);
            const easedProgress = 1 - Math.pow(1 - progress, 3);

            counters.forEach((counter) => {
                const target = Number(counter.dataset.count);
                const value = Math.floor(target * easedProgress);
                counter.textContent = `${value}${counter.dataset.suffix || ''}`;
            });

            if (progress < 1) {
                requestAnimationFrame(updateCounters);
            }
        };

        requestAnimationFrame(updateCounters);
    };

    if (!('IntersectionObserver' in window)) {
        showFinalValues();
        return;
    }

    const observer = new IntersectionObserver((entries, currentObserver) => {
        if (entries.some((entry) => entry.isIntersecting)) {
            animateCounters();
            currentObserver.disconnect();
        }
    }, { threshold: 0.35 });

    observer.observe(statsSection);
});
