import React from 'react';
import { classNames } from 'primereact/utils';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './features/auth/AuthContext';

const AppTopbar = (props) => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const topbarMenuClassName = classNames('topbar-menu fadeInDown', { 'topbar-menu-visible': props.topbarMenuActive });
    const profileItemClassName = classNames('user-profile', { 'active-topmenuitem': props.activeTopbarItem === 'profile' });

    const isProfilePopup = props.profileMode === 'popup' || props.isHorizontal;

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="layout-topbar">
            <button className="layout-topbar-logo p-link" onClick={() => navigate('/')}>
                <img id="layout-topbar-logo" src="assets/layout/images/logo-white.png" alt="babylon-layout" />
            </button>

            <button className="layout-menu-button p-link" onClick={props.onMenuButtonClick}>
                <i className="pi pi-bars"></i>
            </button>

            <button id="topbar-menu-button" className="p-link" onClick={props.onTopbarMenuButtonClick}>
                <i className="pi pi-ellipsis-v"></i>
            </button>

            <ul className={topbarMenuClassName}>
                {isProfilePopup && (
                    <li className={profileItemClassName}>
                        <button className="p-link" onClick={(e) => props.onTopbarItemClick(e, 'profile')}>
                            <img alt="babylon-layout" src="assets/layout/images/avatar.png" />
                            <span className="topbar-item-name">{user ? user.username : 'Operador Taller'}</span>
                        </button>

                        <ul className={classNames({ fadeInDown: !props.isMobile() })}>
                            <li role="menuitem">
                                <button className="p-link" onClick={() => navigate('/settings')}>
                                    <i className="pi pi-user"></i>
                                    <span>{user ? `Rol: ${user.role}` : 'Taller 3D (Bambu Lab A1)'}</span>
                                </button>
                            </li>
                            <li role="menuitem">
                                <button className="p-link" onClick={handleLogout} data-testid="topbar-logout-button">
                                    <i className="pi pi-sign-out"></i>
                                    <span>Cerrar Sesión</span>
                                </button>
                            </li>
                        </ul>
                    </li>
                )}
            </ul>
        </div>
    );
};

export default AppTopbar;
