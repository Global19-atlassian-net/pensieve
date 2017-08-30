import React, { Component } from 'react';
import FontAwesome from 'react-fontawesome';
import { injectGlobal } from 'styled-components';
import { Provider } from 'rebass';
import { connect } from 'react-redux';
import jsyaml from 'js-yaml';
import _ from 'lodash';
import Header from './components/header';
import DocumentViewer from './components/document-viewer';
import Login from './components/login';
import * as GitHubService from './services/github';
import * as DocumentService from './services/document';
import { actions } from './actions';
import { loadRulesFromUrl, updateUrl, searchExists } from './services/path';

/* eslint no-unused-expressions: 0 */
injectGlobal`
  * { box-sizing: border-box; }
  body { margin: 0; }
  font-family: Roboto,Arial,sans-serif;
`;

const theme = {
  font: 'Roboto,Arial,sans-serif',
  monospace: 'Ubuntu Mono Web,Courier New,monospace',
};

class App extends Component {
  constructor(props) {
    super(props);

    this.state = {
      isLoading: false,
    };

    this.props.setConfig(this.props.config);

    DocumentService.setConfig(this.props.config);
  }

  componentWillReceiveProps({ isLoggedIn }) {
    const previouslyLoggedIn = this.props.isLoggedIn;

    if (isLoggedIn === previouslyLoggedIn) {
      return;
    }

    if (!isLoggedIn) {
      return;
    }

    this.setState({
      username: null,
      password: null,
      isLoading: true,
    });

    Promise.all([
      GitHubService.loadSchema(this.props.config),
      GitHubService.getFile(this.props.config.repo),
    ]).then(([schema, source]) => {
      DocumentService.setSource(source);
      this.props.setContent(DocumentService.getJSON());
      this.props.setSchema(schema);
      this.props.setRules(loadRulesFromUrl(schema));
      let views = null;

      GitHubService.getFile(_.assign({}, this.props.config.repo, { file: 'views.yaml' }))
        .then((viewsYaml) => {
          views = jsyaml.load(viewsYaml);
          this.props.setViews(views);
        })
        .catch((err) => {
          console.error(err);
        })
        .finally(() => {
          this.setState({
            isLoading: false,
          });

          const { defaultView } = this.props.config;

          // If a default view has been specified and there is no search query
          // in the url, load the default view.
          if (defaultView && !searchExists()) {
            if (_.isString(defaultView)) {
              // If the default view is a string, assume it is the name of a global view
              const view = _.find(views.global, { name: defaultView });
              if (view) {
                updateUrl(view.rules);
              }
            } else {
              // If the value is not a string, assume it is an array of filter views
              updateUrl(defaultView);
            }
          }

          this.props.setRules(loadRulesFromUrl(schema));
        });
    });
  }

  render() {
    if (!this.props.isLoggedIn) {
      return (
        <Provider theme={theme}>
          <Header />
          <Login />
        </Provider>
      );
    }

    if (this.state.isLoading) {
      return (
        <Provider theme={theme}>
          <Header />
          <div className="container">
            <FontAwesome spin name="cog" />
          </div>
        </Provider>
      );
    }

    return (
      <Provider theme={theme}>
        <Header />
        <DocumentViewer />
      </Provider>
    );
  }
}

const mapStatetoProps = state => ({
  isLoggedIn: state.isLoggedIn,
});

const mapDispatchToProps = dispatch => ({
  setConfig: value => dispatch(actions.setConfig(value)),
  setSchema: value => dispatch(actions.setSchema(value)),
  setRules: value => dispatch(actions.setRules(value)),
  setContent: value => dispatch(actions.setContent(value)),
  setViews: value => dispatch(actions.setViews(value)),
});

export default connect(mapStatetoProps, mapDispatchToProps)(App);