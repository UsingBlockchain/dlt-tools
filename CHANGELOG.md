# CHANGELOG

## v0.3.0

- Refactoring to use Scoped Identities
- Added `core/models/Scope` for grouping Identities by scope
- Renamed `business` to `scope`

## v0.2.0

- Added `nem2-tools network import` nemesis reader, currently compatible only with `catapult-service-bootstrap`
- Added `nem2-tools business create` to create business scopes
- Added `nem2-tools business reader --business "..."`
- Added `nem2-tools identity create` to handle identities within scope of a business
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
