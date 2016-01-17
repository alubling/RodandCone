import React from 'react';
import styles from './App.css';

export default class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {test: 'foo'};
  }
  render() {
    return (
      <div className={styles.app}>
        <h1>Welcome to Rod and Cone, we make buying contacts suck less</h1> 
      </div>
    );
  }
}
