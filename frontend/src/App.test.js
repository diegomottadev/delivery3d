import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import AppWrapper from './AppWrapper';

it('renders without crashing', () => {
    const div = document.createElement('div');
    const root = createRoot(div);
    root.render(
        <HashRouter>
            <AppWrapper />
        </HashRouter>
    );
    root.unmount();
});

it('renders /orders route', async () => {
    const div = document.createElement('div');
    const root = createRoot(div);
    window.location.hash = '#/orders';
    root.render(
        <HashRouter>
            <AppWrapper />
        </HashRouter>
    );
    root.unmount();
});

