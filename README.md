
<p align="center"><img src="https://evias.be/wp-content/uploads/2019/03/ESlogo.png" width="200"></p>

# NEM2 Business Solutions

The `nem2-business-tools` package aims to provide with a business-ready solution for using the NEM2 (Catapult-engine) blockchain.

It uses Typescript and provides with several command line tools to manage different aspects of businesses that can be managed through different features of the NEM2 blockchain.

*The author of this package cannot be held responsible for any loss of money or any malintentioned usage forms of this package. Please use this package with caution.*

Package licensed under [BSD 3-Clause](LICENSE) License.

## Donations / Pot de vin

Donations can be made with cryptocurrencies and will be used for running the project!

    NEM:       NB72EM6TTSX72O47T3GQFL345AB5WYKIDODKPPYW
    Bitcoin:   3EVqgUqYFRYbf9RjhyjBgKXcEwAQxhaf6o

| Username | Role |
| --- | --- |
| [eVias](https://github.com/evias) | Project Lead |

## Usage

Suitable documentation will be provided with the course of development. Following modules are currently available:

## Configuration

This command line suite comes with a JSON configuration file in `config/app.json`. First versions of this tool will include private account information that will be removed from the configuration once the network setup scripts have been added.

### Tool #1: Import your private network's first Nemesis Account

The following command will ask you to fill out some information about your *private network* and will then take care of importing the *first nemesis account* of your private network as an **identity** in your installation.

This nemesis account reader currently **only works with [catapult-service-bootstrap](https://github.com/nemtech/catapult-service-bootstrap) and is meant to read your locally running private chain network.

```bash
$ ./bin/nem2-tools network import
```

### Tool #2: Create new Identities for your Business

The following command will ask you to fill out some information about your *identity* and will then take care of creating namespaces, aliases and sending initial funds to the identity's account.

```bash
$ ./bin/nem2-tools identity create -n "your-named-identity"
```

You can also create an identity **only locally** without adding namespaces and aliases on-chain:

```bash
$ ./bin/nem2-tools identity create --name "your-named-identity" --local
```

### Tool #3: Create named assets with the Catapult engine

The following command will ask you to fill out some information about your *asset* and will then take care of creating your home-baked crypto currency on your private blockchain network.

```bash
$ ./bin/nem2-tools assets create
```

### Tool #4: Register namespaces with the Catapult engine

The following command will ask you to fill out the name of your *namespace* and will then take care of registering your namespace for a said duration in your private blockchain network.

```bash
$ ./bin/nem2-tools names create
```

## Changelog

Important versions listed below. Refer to the [Changelog](CHANGELOG.md) for a full history of the project.

- [0.2.0](CHANGELOG.md#v020) - 2019-03-29
- [0.1.0](CHANGELOG.md#v010) - 2019-03-24

## License

This software is released under the [BSD 3-Clause](LICENSE) License.

Copyright 2019 eVias Services ([evias.be](https://evias.be)), All rights reserved.
