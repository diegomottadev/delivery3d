import React, { useState, useRef, useEffect, useMemo } from 'react';
import { classNames } from 'primereact/utils';
import { Route, Routes, useNavigate, useLocation } from 'react-router-dom';

import AppTopbar from './AppTopbar';
import AppFooter from './AppFooter';
import AppConfig from './AppConfig';
import AppMenu from './AppMenu';
import AppBreadcrumb from './AppBreadcrumb';
import AppInlineProfile from './AppInlineProfile';
import OrderList from './features/orders/OrderList';
import WorkshopSettingsView from './features/settings/WorkshopSettingsView';
import CashboxView from './features/cashbox/CashboxView';
import CashboxSettingsView from './features/cashbox/CashboxSettingsView';
import SplitDashboardView from './features/dashboard/SplitDashboardView';
import AccessDeniedView from './features/security/AccessDeniedView';
import UsersListView from './features/security/users/UsersListView';
import UserDetailView from './features/security/users/UserDetailView';
import GroupsListView from './features/security/groups/GroupsListView';
import GroupDetailView from './features/security/groups/GroupDetailView';
import RolesListView from './features/security/roles/RolesListView';
import RoleDetailView from './features/security/roles/RoleDetailView';
import PermissionsCatalogView from './features/security/permissions-catalog/PermissionsCatalogView';
import { usePermissions } from './features/security/permissions/PermissionsContext';
import { RequirePermission, ACCESS_DENIED_PATH } from './features/security/permissions/RequirePermission';
import { PermissionsLoadError } from './features/security/permissions/PermissionsLoadError';
import { PERM } from './features/security/permissions/perms';
import { MENU_CONFIG, DETAIL_ROUTES } from './navigation/menuConfig';
import { buildMenu, buildBreadcrumb, guardFor, findBreadcrumbMeta } from './navigation/buildMenu';


import PrimeReact from 'primereact/api';
import { Tooltip } from 'primereact/tooltip';

import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';
import 'primeflex/primeflex.css';
import './App.scss';

const App = () => {
    const [menuActive, setMenuActive] = useState(false);
    const [menuMode, setMenuMode] = useState('static');
    const [darkMenu, setDarkMenu] = useState(true);
    const [overlayMenuActive, setOverlayMenuActive] = useState(false);
    const [topbarMenuActive, setTopbarMenuActive] = useState(false);
    const [staticMenuDesktopInactive, setStaticMenuDesktopInactive] = useState(false);
    const [staticMenuMobileActive, setStaticMenuMobileActive] = useState(false);
    const [activeTopbarItem, setActiveTopbarItem] = useState(null);
    const [inlineMenuActive, setInlineMenuActive] = useState(false);
    const [profileMode, setProfileMode] = useState('popup');
    const [configActive, setConfigActive] = useState(false);
    const [inputStyle, setInputStyle] = useState('outlined');
    const [ripple, setRipple] = useState(false);
    const copyTooltipRef = useRef();
    const location = useLocation();

    const navigate = useNavigate();

    let menuClick = false;
    let configClick = false;
    let topbarItemClick = false;
    let inlineMenuClick = false;

    const { can, status: permissionsStatus } = usePermissions();

    const breadcrumb = useMemo(
        () => [...buildBreadcrumb(MENU_CONFIG), ...DETAIL_ROUTES, { path: ACCESS_DENIED_PATH, parent: 'Delivery3D', label: 'Acceso denegado' }],
        []
    );

    // El menú sale de MENU_CONFIG filtrado por permisos (sin ifs en el JSX).
    const menu = useMemo(() => buildMenu(MENU_CONFIG, can), [can]);

    useEffect(() => {
        copyTooltipRef && copyTooltipRef.current && copyTooltipRef.current.updateTargetEvents();
    }, [location]);

    const meta = findBreadcrumbMeta(breadcrumb, location.pathname) || { path: location.pathname, parent: 'Delivery3D', label: 'Taller 3D' };

    const onInputStyleChange = (inputStyle) => {
        setInputStyle(inputStyle);
    };

    const onRippleChange = (e) => {
        PrimeReact.ripple = e.value;
        setRipple(e.value);
    };

    const onMenuModeChange = (e) => {
        setMenuMode(e.value);
        setStaticMenuDesktopInactive(false);
        setOverlayMenuActive(false);

        if (e.value === 'horizontal') {
            setProfileMode('popup');
        }
    };

    const onMenuColorChange = (e) => {
        setDarkMenu(e.value);
    };

    const onProfileChange = (e) => {
        setProfileMode(e.value);
    };

    const onDocumentClick = () => {
        if (!topbarItemClick) {
            setActiveTopbarItem(null);
            setTopbarMenuActive(false);
        }

        if (!menuClick) {
            if (isHorizontal() || isSlim()) {
                setMenuActive(false);
            }
            hideOverlayMenu();
        }

        if (!inlineMenuClick && profileMode === 'inline' && isSlim() && !isMobile()) {
            setInlineMenuActive(false);
        }

        if (configActive && !configClick) {
            setConfigActive(false);
        }

        inlineMenuClick = false;
        configClick = false;
        topbarItemClick = false;
        menuClick = false;
    };

    const onMenuitemClick = (event) => {
        if (!event.item.items) {
            hideOverlayMenu();

            if (isSlim() || isHorizontal()) {
                setMenuActive(false);
            }
        }
    };

    const onRootMenuitemClick = () => {
        setMenuActive((prevMenuActive) => !prevMenuActive);
    };

    const onMenuClick = () => {
        menuClick = true;

        if (inlineMenuActive && !inlineMenuClick) {
            setInlineMenuActive(false);
        }
    };

    const isMenuVisible = () => {
        if (isDesktop()) {
            if (menuMode === 'static') return !staticMenuDesktopInactive;
            else if (menuMode === 'overlay') return overlayMenuActive;
            else return true;
        } else {
            return true;
        }
    };

    const onMenuButtonClick = (event) => {
        menuClick = true;
        setTopbarMenuActive(false);

        if (isOverlay() && !isMobile()) {
            setOverlayMenuActive((prevOverlayMenuActive) => !prevOverlayMenuActive);
        } else {
            if (isDesktop()) {
                setStaticMenuDesktopInactive((prevStaticMenuDesktopInactive) => !prevStaticMenuDesktopInactive);
            } else {
                setStaticMenuMobileActive((prevStaticMenuMobileActive) => !prevStaticMenuMobileActive);
            }
        }

        event.preventDefault();
    };

    const onProfileButtonClick = (event) => {
        setInlineMenuActive((prevInlineMenuActive) => !prevInlineMenuActive);
        inlineMenuClick = true;

        if (isSlim() || isHorizontal()) {
            setMenuActive(false);
        }
    };

    const onTopbarMenuButtonClick = (event) => {
        topbarItemClick = true;
        setTopbarMenuActive((prevTopbarMenuActive) => !prevTopbarMenuActive);

        hideOverlayMenu();

        event.preventDefault();
    };

    const onTopbarItemClick = (event, item) => {
        topbarItemClick = true;

        if (activeTopbarItem === item) {
            setActiveTopbarItem(null);
        } else {
            setActiveTopbarItem(item);
        }

        event.preventDefault();
    };

    const onConfigClick = () => {
        configClick = true;
    };

    const onConfigButtonClick = () => {
        setConfigActive((prevConfigActive) => !prevConfigActive);
        configClick = true;
    };

    const hideOverlayMenu = () => {
        setOverlayMenuActive(false);
        setStaticMenuMobileActive(false);
    };

    const isDesktop = () => {
        return window.innerWidth > 896;
    };

    const isMobile = () => {
        return window.innerWidth <= 896;
    };

    const isOverlay = () => {
        return menuMode === 'overlay';
    };

    const isHorizontal = () => {
        return menuMode === 'horizontal';
    };

    const isSlim = () => {
        return menuMode === 'slim';
    };

    const isStatic = () => {
        return menuMode === 'static';
    };

    const hasInlineProfile = profileMode === 'inline' && !isHorizontal();

    const containerClassName = classNames('layout-wrapper', {
        'layout-static': isStatic(),
        'layout-overlay': isOverlay(),
        'layout-overlay-active': overlayMenuActive,
        'layout-horizontal': isHorizontal(),
        'layout-slim': isSlim(),
        'layout-static-inactive': staticMenuDesktopInactive,
        'layout-mobile-active': staticMenuMobileActive,
        'layout-menu-dark': darkMenu,
        'layout-menu-light': !darkMenu,
        'p-input-filled': inputStyle === 'filled',
        'p-ripple-disabled': !ripple
    });

    const menuContainerClassName = classNames('layout-menu-container', { 'layout-menu-container-inactive': !isMenuVisible() });

    return (
        <div className={containerClassName} onClick={onDocumentClick}>
            <Tooltip ref={copyTooltipRef} target=".block-action-copy" position="bottom" content="Copied to clipboard" event="focus" />

            <AppTopbar
                topbarMenuActive={topbarMenuActive}
                activeTopbarItem={activeTopbarItem}
                onMenuButtonClick={onMenuButtonClick}
                onTopbarMenuButtonClick={onTopbarMenuButtonClick}
                onTopbarItemClick={onTopbarItemClick}
                isHorizontal={isHorizontal()}
                profileMode={profileMode}
                isMobile={isMobile}
            />

            <div className={menuContainerClassName} onClick={onMenuClick}>
                <div className="layout-menu-logo">
                    <button className="p-link" onClick={() => navigate('/')}>
                        <img id="layout-menu-logo" src="assets/layout/images/logo-white.png" library="babylon-layout" alt="babylon-logo" />
                    </button>
                </div>
                <div className="layout-menu-wrapper">
                    <div className="menu-scroll-content">
                        {hasInlineProfile && <AppInlineProfile inlineMenuActive={inlineMenuActive} onProfileButtonClick={onProfileButtonClick} />}
                        <AppMenu model={menu} menuMode={menuMode} active={menuActive} onMenuitemClick={onMenuitemClick} onRootMenuitemClick={onRootMenuitemClick} />
                    </div>
                </div>
            </div>

            <div className="layout-main">
                <AppBreadcrumb meta={meta} />

                <div className="layout-content">
                    {permissionsStatus === 'error' && <PermissionsLoadError />}
                    <Routes>
                        <Route path="/" element={<RequirePermission {...guardFor(MENU_CONFIG, '/')}><SplitDashboardView /></RequirePermission>} />
                        <Route path="/orders" element={<RequirePermission {...guardFor(MENU_CONFIG, '/orders')}><OrderList /></RequirePermission>} />
                        <Route path="/cashbox" element={<RequirePermission {...guardFor(MENU_CONFIG, '/cashbox')}><CashboxView /></RequirePermission>} />
                        <Route
                            path="/cashbox/settings"
                            element={<RequirePermission {...guardFor(MENU_CONFIG, '/cashbox/settings')}><CashboxSettingsView /></RequirePermission>}
                        />
                        <Route path="/settings" element={<RequirePermission {...guardFor(MENU_CONFIG, '/settings')}><WorkshopSettingsView /></RequirePermission>} />
                        <Route path="/seguridad/usuarios" element={<RequirePermission {...guardFor(MENU_CONFIG, '/seguridad/usuarios')}><UsersListView /></RequirePermission>} />
                        <Route path="/seguridad/grupos" element={<RequirePermission {...guardFor(MENU_CONFIG, '/seguridad/grupos')}><GroupsListView /></RequirePermission>} />
                        <Route path="/seguridad/roles" element={<RequirePermission {...guardFor(MENU_CONFIG, '/seguridad/roles')}><RolesListView /></RequirePermission>} />
                        <Route path="/seguridad/usuarios/:userId" element={<RequirePermission perm={PERM.RBAC_READ}><UserDetailView /></RequirePermission>} />
                        <Route path="/seguridad/grupos/:groupId" element={<RequirePermission perm={PERM.RBAC_READ}><GroupDetailView /></RequirePermission>} />
                        <Route path="/seguridad/roles/:roleId" element={<RequirePermission perm={PERM.RBAC_READ}><RoleDetailView /></RequirePermission>} />
                        <Route
                            path="/seguridad/permisos"
                            element={<RequirePermission perm={PERM.RBAC_READ}><PermissionsCatalogView /></RequirePermission>}
                        />
                        <Route path={ACCESS_DENIED_PATH} element={<AccessDeniedView />} />
                        <Route path="*" element={<RequirePermission {...guardFor(MENU_CONFIG, '/')}><SplitDashboardView /></RequirePermission>} />
                    </Routes>
                </div>

                <AppFooter />
            </div>

            <AppConfig
                configActive={configActive}
                menuMode={menuMode}
                onMenuModeChange={onMenuModeChange}
                isDarkMenu={darkMenu}
                onMenuColorChange={onMenuColorChange}
                profileMode={profileMode}
                onProfileChange={onProfileChange}
                onConfigClick={onConfigClick}
                onConfigButtonClick={onConfigButtonClick}
                rippleActive={ripple}
                onRippleChange={onRippleChange}
                inputStyle={inputStyle}
                onInputStyleChange={onInputStyleChange}
            ></AppConfig>

            {staticMenuMobileActive && <div className="layout-mask"></div>}
        </div>
    );
};

export default App;
