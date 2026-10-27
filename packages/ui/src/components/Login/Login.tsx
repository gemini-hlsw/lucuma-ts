import './Login.css';

import orcidLogo from '@assets/orcid-logo.svg';
import { Astronaut } from '@gemini-hlsw/lucuma-common-ui';
import { Button } from 'primereact/button';
import { Image } from 'primereact/image';
import { Link } from 'react-router';

import { useGuestLogin, useSignInURL } from '@/auth/hooks';

export default function Login() {
  const signinURL = useSignInURL();
  const guestLogin = useGuestLogin();

  return (
    <div className="login">
      <div className="box">
        <div className="title">
          <div className="text">Navigate</div>
        </div>
        <div className="user-login-buttons">
          <Link to={signinURL} className="orcid-login-link">
            <Button
              icon={<Image className="orcid-login-icon" alt="ORCID logo" src={orcidLogo} height="21" />}
              label="Login with ORCID"
              size="large"
            />
          </Link>
          <Button icon={<Astronaut />} label="Continue as Guest" size="large" onClick={guestLogin} outlined />
        </div>
      </div>
    </div>
  );
}
