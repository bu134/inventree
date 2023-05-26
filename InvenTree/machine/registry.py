import logging
from typing import Dict, List, Union
from uuid import UUID

from machine.machine_type import BaseDriver, BaseMachineType

logger = logging.getLogger('inventree')


class MachinesRegistry:
    def __init__(self) -> None:
        """Initialize machine registry

        Set up all needed references for internal and external states.
        """

        self.machine_types: Dict[str, BaseMachineType] = {}
        self.drivers: Dict[str, BaseDriver] = {}
        self.driver_instances: Dict[str, BaseDriver] = {}
        self.machines: Dict[str, BaseMachineType] = {}

        self.base_drivers: List[BaseDriver] = []
        self.errors = []

    def initialize(self):
        print("INITIALIZE")  # TODO: remove debug statement
        self.discover_machine_types()
        self.discover_drivers()
        self.load_machines()

    def discover_machine_types(self):
        import InvenTree.helpers

        logger.debug("Collecting machine types")

        machine_types: Dict[str, BaseMachineType] = {}
        base_drivers: List[BaseDriver] = []

        discovered_machine_types: List[BaseMachineType] = InvenTree.helpers.inheritors(BaseMachineType)
        for machine_type in discovered_machine_types:
            try:
                machine_type.validate()
            except NotImplementedError as error:
                self.errors.append(error)
                continue

            machine_types[machine_type.SLUG] = machine_type
            base_drivers.append(machine_type.base_driver)

        self.machine_types = machine_types
        self.base_drivers = base_drivers

        logger.debug(f"Found {len(self.machine_types.keys())} machine types")

    def discover_drivers(self):
        import InvenTree.helpers

        logger.debug("Collecting machine drivers")

        drivers: Dict[str, BaseDriver] = {}

        discovered_drivers: List[BaseDriver] = InvenTree.helpers.inheritors(BaseDriver)
        for driver in discovered_drivers:
            # skip discovered drivers that define a base driver for a machine type
            if driver in self.base_drivers:
                continue

            try:
                driver.validate()
            except NotImplementedError as error:
                self.errors.append(error)
                continue

            drivers[driver.SLUG] = driver

        self.drivers = drivers

        logger.debug(f"Found {len(self.drivers.keys())} machine drivers")

    def get_driver_instance(self, slug: str):
        if slug not in self.driver_instances:
            driver = self.drivers.get(slug, None)
            if driver is None:
                return None

            self.driver_instances[slug] = driver()

        return self.driver_instances.get(slug, None)

    def load_machines(self):
        # Imports need to be in this level to prevent early db model imports
        from machine.models import MachineConfig

        for machine_config in MachineConfig.objects.all():
            self.add_machine(machine_config, initialize=False)

        # initialize machines after all machine instances were created
        for machine in self.machines.values():
            machine.initialize()

    def add_machine(self, machine_config, initialize=True):
        machine_type = self.machine_types.get(machine_config.machine_type_key, None)
        if machine_type is None:
            self.errors.append(f"Machine type '{machine_config.machine_type_key}' not found")
            return

        machine: BaseMachineType = machine_type(machine_config)
        self.machines[str(machine.pk)] = machine

        if initialize:
            machine.initialize()

    def get_machines(self, **kwargs):
        """Get loaded machines from registry. (By default only active machines)

        Kwargs:
            name: Machine name
            machine_type: Machine type definition (class)
            driver: Machine driver (class)
            active: (bool, default: True)
            base_driver: base driver (class | List[class])
        """
        allowed_fields = ["name", "machine_type", "driver", "active", "base_driver"]

        kwargs = {**{'active': True}, **kwargs}

        def filter_machine(machine: BaseMachineType):
            for key, value in kwargs.items():
                if key not in allowed_fields:
                    continue

                # check if current driver is subclass from base_driver
                if key == "base_driver":
                    if machine.driver and not issubclass(machine.driver.__class__, value):
                        return False

                # check if current machine is subclass from machine_type
                elif key == "machine_type":
                    if issubclass(machine.__class__, value):
                        return False

                # check attributes of machine
                elif value != getattr(machine, key, None):
                    return False

            return True

        return list(filter(filter_machine, self.machines.values()))

    def get_machine(self, pk: Union[str, UUID]):
        """Get machine from registry by pk."""
        return self.machines.get(str(pk), None)


registry: MachinesRegistry = MachinesRegistry()
