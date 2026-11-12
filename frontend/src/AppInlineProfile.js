import React, { useRef } from 'react';
import { classNames } from 'primereact/utils';
import { CSSTransition } from 'react-transition-group';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './features/auth/AuthContext';

const AppInlineProfile = (props) => {
    const menuRef = useRef(null);
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const profileClassName = classNames('layout-profile', { 'layout-profile-active': props.inlineMenuActive });
    const menuitemLinkTabindex = !props.inlineMenuActive ? '-1' : null;

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className={profileClassName}>
            <button type="button" onClick={props.onProfileButtonClick} className="p-link layout-profile-button">
                <img src="assets/layout/images/avatar.png" alt="babylon-layout" />
                <div className="layout-profile-userinfo">
                    <span className="layout-profile-name">{user ? user.username : 'Operador Taller'}</span>
                    <span className="layout-profile-role">{user ? user.role.toUpperCase() : 'TALLER 3D'}</span>
                </div>
                <i className="layout-profile-icon pi pi-angle-down"></i>
            </button>
            <CSSTransition nodeRef={menuRef} classNames="layout-profile-menu" in={props.inlineMenuActive} timeout={{ enter: 1000, exit: 400 }} unmountOnExit>
                <ul ref={menuRef} className="layout-profile-menu">
                    <li role="menuitem">
                        <button type="button" className="p-link" onClick={() => navigate('/settings')} tabIndex={menuitemLinkTabindex}>
                            <i className="pi pi-cog"></i>
                            <span>Configuración</span>
                        </button>
                    </li>
                    <li role="menuitem">
                        <button type="button" className="p-link" onClick={handleLogout} tabIndex={menuitemLinkTabindex} data-testid="inline-logout-button">
                            <i className="pi pi-sign-out"></i>
                            <span>Cerrar Sesión</span>
                        </button>
                    </li>
                </ul>
            </CSSTransition>
        </div>
    );
};

export default AppInlineProfile;
