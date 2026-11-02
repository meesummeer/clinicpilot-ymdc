import { Component } from 'react';
import CloudBackupCard from '../components/CloudBackupCard';

// A failure inside one card must never take the rest of Settings down.
class CardBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return <div className="card"><div className="error-text">This section failed to load. Reload the page to try again.</div></div>;
    }
    return this.props.children;
  }
}

export default function Settings({ profile, session }) {
  return (
    <div>
      <CardBoundary>
        <CloudBackupCard profile={profile} session={session} />
      </CardBoundary>
    </div>
  );
}
