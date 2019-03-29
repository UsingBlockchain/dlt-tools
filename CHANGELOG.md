# CHANGELOG

## v0.2.0

- Added `nem2-tools network import` nemesis reader, currently compatible only with `catapult-service-bootstrap`
- Added `nem2-tools identity create` to handle identities within scope of the project
- Added `core/services/IdentityService`
- Added `core/services/CatapultService` currently compatible only with `catapult-service-bootstrap`
- Added `core/repositories/IdentityRepository`
- Added `core/repositories/BootstrapRepository` currently compatible only with `catapult-service-bootstrap`
- Added `core/models/Identity`
- Added `core/AuthenticatedAction` for commands that require identities

## v0.1.0

- Added `core/Bootstrap`
- Added `core/Connector`
- Added `core/Monitor`
- Added `core/Options`
- Added `core/Action` base command
- Added `nem2-tools assets create`
- Added `nem2-tools names create`
