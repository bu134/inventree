"""Install a plugin into the python virtual environment."""

import logging
import pathlib
import re
import shutil
import subprocess
import sys

from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _

import plugin.models
import plugin.staticfiles
from InvenTree.config import get_plugin_dir
from InvenTree.exceptions import log_error

logger = logging.getLogger('inventree')


def pip_command(*args):
    """Build and run a pip command using using the current python executable.

    Returns: The output of the pip command

    Raises:
        subprocess.CalledProcessError: If the pip command fails
    """
    python = sys.executable

    command = [python, '-m', 'pip']
    command.extend(args)

    command = [str(x) for x in command]

    logger.info('Running pip command: %s', ' '.join(command))

    return subprocess.check_output(
        command, cwd=settings.BASE_DIR.parent, stderr=subprocess.STDOUT
    )


def handle_pip_error(error, path: str) -> list:
    """Raise a ValidationError when the pip command fails.

    - Log the error to the database
    - Format the output from a pip command into a list of error messages.
    - Raise an appropriate error
    """
    log_error(path)

    output = error.output.decode('utf-8')

    logger.error('Pip command failed: %s', output)

    errors = []

    for line in output.split('\n'):
        line = line.strip()

        if line:
            errors.append(line)

    if len(errors) > 1:
        raise ValidationError(errors)
    else:
        raise ValidationError(errors[0])


def check_plugins_path(packagename: str) -> bool:
    """Determine if the package is installed in the plugins directory."""
    # Remove version information
    for c in '<>=! ':
        packagename = packagename.split(c)[0]

    plugin_dir = get_plugin_dir()

    if not plugin_dir:
        return False

    plugin_dir_path = pathlib.Path(plugin_dir)

    if not plugin_dir_path.exists():
        return False

    result = pip_command('freeze', '--path', plugin_dir_path.absolute())
    output = result.decode('utf-8').split('\n')

    # Check if the package is installed in the plugins directory
    return any(re.match(f'^{packagename}==', line.strip()) for line in output)


def check_package_path(packagename: str) -> str:
    """Determine the install path of a particular package.

    - If installed, return the installation path
    - If not installed, return an empty string
    """
    logger.debug('check_package_path: %s', packagename)

    # First check if the package is installed in the plugins directory
    if check_plugins_path(packagename):
        return f'plugins/{packagename}'

    # Remove version information
    for c in '<>=! ':
        packagename = packagename.split(c)[0]

    try:
        result = pip_command('show', packagename)

        output = result.decode('utf-8').split('\n')

        for line in output:
            # Check if line matches pattern "Location: ..."
            match = re.match(r'^Location:\s+(.+)$', line.strip())

            if match:
                return match.group(1)

    except subprocess.CalledProcessError as error:
        log_error('check_package_path')

        output = error.output.decode('utf-8')
        logger.exception('Plugin lookup failed: %s', str(output))
        return False

    # If we get here, the package is not installed
    return ''


def plugins_dir():
    """Return the path to the InvenTree custom plugins director.

    Returns:
        pathlib.Path: Path to the custom plugins directory

    Raises:
        ValidationError: If the plugins directory is not specified, or does not exist
    """
    pd = get_plugin_dir()

    if not pd:
        raise ValidationError(_('Plugins directory not specified'))

    pd = pathlib.Path(pd)

    if not pd.exists():
        try:
            pd.mkdir(parents=True, exist_ok=True)
        except Exception:
            raise ValidationError(_('Failed to create plugin directory'))

    return pd.absolute()


def install_plugin(url=None, packagename=None, user=None, version=None):
    """Install a plugin into the python virtual environment.

    Args:
        packagename: Optional package name to install
        url: Optional URL to install from
        user: Optional user performing the installation
        version: Optional version specifier
    """
    if user and not user.is_staff:
        raise ValidationError(_('Only staff users can administer plugins'))

    if settings.PLUGINS_INSTALL_DISABLED:
        raise ValidationError(_('Plugin installation is disabled'))

    logger.info('install_plugin: %s, %s', url, packagename)

    plugin_dir = plugins_dir()

    # build up the command
    install_name = ['install', '-U', '--target', str(plugin_dir)]

    full_pkg = ''

    if url:
        # use custom registration / VCS
        if True in [
            identifier in url for identifier in ['git+https', 'hg+https', 'svn+svn']
        ]:
            # using a VCS provider
            full_pkg = f'{packagename}@{url}' if packagename else url
        elif url:
            install_name.append('-i')
            full_pkg = url
        elif packagename:
            full_pkg = packagename

    elif packagename:
        # use pypi
        full_pkg = packagename

        if version:
            full_pkg = f'{full_pkg}=={version}'

    install_name.append(full_pkg)

    ret = {}

    # Execute installation via pip
    try:
        result = pip_command(*install_name)

        ret['result'] = ret['success'] = _('Installed plugin successfully')
        ret['output'] = str(result, 'utf-8')

        if packagename and (path := check_package_path(packagename)):
            # Override result information
            ret['result'] = _(f'Installed plugin into {path}')

    except subprocess.CalledProcessError as error:
        handle_pip_error(error, 'plugin_install')

    # Reload the plugin registry, to discover the new plugin
    from plugin.registry import registry

    registry.reload_plugins(full_reload=True, force_reload=True, collect=True)

    # Update static files
    plugin.staticfiles.collect_plugins_static_files()

    return ret


def validate_package_plugin(cfg: plugin.models.PluginConfig, user=None):
    """Validate a package plugin for update or removal."""
    if not cfg.plugin:
        raise ValidationError(_('Plugin was not found in registry'))

    if not cfg.is_package():
        raise ValidationError(_('Plugin is not a packaged plugin'))

    if not cfg.package_name:
        raise ValidationError(_('Plugin package name not found'))

    if user and not user.is_staff:
        raise ValidationError(_('Only staff users can administer plugins'))


def uninstall_plugin(cfg: plugin.models.PluginConfig, user=None, delete_config=True):
    """Uninstall a plugin from the python virtual environment.

    - The plugin must not be active
    - The plugin must be a "package" and have a valid package name

    Args:
        cfg: PluginConfig object
        user: User performing the uninstall
        delete_config: If True, delete the plugin configuration from the database
    """
    from plugin.registry import registry

    if settings.PLUGINS_INSTALL_DISABLED:
        raise ValidationError(_('Plugin uninstalling is disabled'))

    if cfg.active:
        raise ValidationError(
            _('Plugin cannot be uninstalled as it is currently active')
        )

    if not cfg.is_installed():
        raise ValidationError(_('Plugin is not installed'))

    validate_package_plugin(cfg, user)
    package_name = cfg.package_name
    logger.info('Uninstalling plugin: %s', package_name)

    if check_plugins_path(package_name):
        # Uninstall the plugin from the plugins directory
        uninstall_from_plugins_dir(cfg)
    elif check_package_path(package_name):
        # Uninstall the plugin using pip
        uninstall_from_pip(cfg)
    else:
        # No matching install target found
        raise ValidationError(_('Plugin installation not found'))

    if delete_config:
        # Remove the plugin configuration from the database
        cfg.delete()

    # Remove static files associated with this plugin
    plugin.staticfiles.clear_plugin_static_files(cfg.key)

    # Reload the plugin registry
    registry.reload_plugins(full_reload=True, force_reload=True, collect=True)

    return {'result': _('Uninstalled plugin successfully'), 'success': True}


def uninstall_from_plugins_dir(cfg: plugin.models.PluginConfig):
    """Uninstall a plugin from the plugins directory."""
    package_name = cfg.package_name
    logger.debug('Uninstalling plugin from plugins directory: %s', package_name)

    plugin_install_dir = plugins_dir()
    plugin_dir = cfg.plugin.path()

    if plugin_dir.is_relative_to(plugin_install_dir):
        # Find the top-most relative path
        while plugin_dir.parent and plugin_dir.parent != plugin_install_dir:
            plugin_dir = plugin_dir.parent

        if plugin_dir and plugin_dir.is_relative_to(plugin_install_dir):
            logger.info('Removing plugin directory: %s', plugin_dir)
            try:
                shutil.rmtree(plugin_dir)
            except Exception:
                logger.exception('Failed to remove plugin directory: %s', plugin_dir)
                log_error(f'plugins.{package_name}.uninstall_from_plugins_dir')
                raise ValidationError(_('Failed to remove plugin directory'))

            # Finally, remove the dist-info directory (if it exists)
            dist_pkg_name = package_name.replace('-', '_')
            dist_dirs = plugin_install_dir.glob(f'{dist_pkg_name}-*.dist-info')

            for dd in dist_dirs:
                logger.info('Removing dist-info directory: %s', dd)
                try:
                    shutil.rmtree(dd)
                except Exception:
                    logger.exception('Failed to remove dist-info directory: %s', dd)
                    log_error(f'plugins.{package_name}.uninstall_from_plugins_dir')
                    raise ValidationError(_('Failed to remove plugin directory'))


def uninstall_from_pip(cfg: plugin.models.PluginConfig):
    """Uninstall a plugin using pip."""
    package_name = cfg.package_name

    logger.debug('Uninstalling plugin via PIP: %s', package_name)

    cmd = ['uninstall', '-y', package_name]

    try:
        pip_command(*cmd)

    except subprocess.CalledProcessError as error:
        handle_pip_error(error, 'plugin_uninstall')
