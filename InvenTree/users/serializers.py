"""DRF API serializers for the 'users' app"""

from django.contrib.auth.models import User

from rest_framework import serializers

from InvenTree.serializers import InvenTreeModelSerializer

from .models import Owner


class UserSerializer(InvenTreeModelSerializer):
    """Serializer for a User."""

    class Meta:
        """Metaclass defines serializer fields"""
        model = User
        fields = ('pk',
                  'username',
                  'first_name',
                  'last_name',
                  'email',)


class OwnerSerializer(InvenTreeModelSerializer):
    """Serializer for an "Owner" (either a "user" or a "group")"""

    name = serializers.CharField(read_only=True)

    label = serializers.CharField(read_only=True)

    class Meta:
        """Metaclass defines serializer fields"""
        model = Owner
        fields = [
            'pk',
            'owner_id',
            'name',
            'label',
        ]
