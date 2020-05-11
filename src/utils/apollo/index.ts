import ApolloClient from "apollo-client"
import { split } from "apollo-link"
import { setContext } from "apollo-link-context"
import { onError } from "apollo-link-error"
import { HttpLink } from "apollo-link-http"
import { WebSocketLink } from "apollo-link-ws"
import fetch from "isomorphic-fetch" // Comment out this line results in an error ...
import { InMemoryCache } from "apollo-cache-inmemory"
import { getMainDefinition } from "apollo-utilities"

/*
https://github.com/apollographql/subscriptions-transport-ws/issues/333
*/

const HTTP_URI = `http://localhost:4000/graphql`
const WS_URI = `ws://localhost:4000/graphql`

// const HTTP_URI = `https://hendry-gql-server.herokuapp.com/graphql`
// const WS_URI = `wss://hendry-gql-server.herokuapp.com/graphql`

const isBrowser = () => typeof window !== "undefined"

const httplink = new HttpLink({
  uri: HTTP_URI,
  fetch,
})

const wsLink = isBrowser()
  ? new WebSocketLink({
      // if you instantiate in the server, the error will be thrown
      uri: WS_URI,
      options: {
        reconnect: true,
        connectionParams: {
          authToken: localStorage.getItem("token"),
        },
      },
    })
  : null

// authMiddleware
const authLink = isBrowser()
  ? setContext(async (req, { headers }) => {
      const token = localStorage.getItem("token")
      console.log("authLink token", token)
      return {
        headers: {
          ...headers,
          authorization: token ? `${token}` : "",
        },
      }
    })
  : null

const errorLink = isBrowser()
  ? onError(({ networkError, graphQLErrors }) => {
      if (graphQLErrors) {
        graphQLErrors.map(({ message, locations, path }) =>
          console.log(
            `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`
          )
        )
      }
      if (networkError) console.log(`[Network error]: ${networkError}`)
    })
  : null

const link = isBrowser()
  ? split(
      //only create the split in the browser
      // split based on operation type
      ({ query }: any) => {
        const { kind, operation }: any = getMainDefinition(query)
        return kind === "OperationDefinition" && operation === "subscription"
      },
      wsLink!,
      errorLink!.concat(authLink!.concat(httplink))
    )
  : httplink

export const client = new ApolloClient({
  link,
  cache: new InMemoryCache(),
})
