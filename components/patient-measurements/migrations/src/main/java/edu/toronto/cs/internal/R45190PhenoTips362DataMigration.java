/*
 * See the NOTICE file distributed with this work for additional
 * information regarding copyright ownership.
 *
 * This is free software; you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as
 * published by the Free Software Foundation; either version 2.1 of
 * the License, or (at your option) any later version.
 *
 * This software is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this software; if not, write to the Free
 * Software Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA
 * 02110-1301 USA, or see the FSF site: http://www.fsf.org.
 */

package edu.toronto.cs.internal;

import java.util.List;

import javax.inject.Named;
import javax.inject.Singleton;

import org.hibernate.HibernateException;
import org.hibernate.Query;
import org.hibernate.Session;
import org.xwiki.component.annotation.Component;

import com.xpn.xwiki.XWikiException;
import com.xpn.xwiki.objects.FloatProperty;
import com.xpn.xwiki.store.XWikiHibernateBaseStore.HibernateCallback;
import com.xpn.xwiki.store.migration.DataMigrationException;
import com.xpn.xwiki.store.migration.XWikiDBVersion;
import com.xpn.xwiki.store.migration.hibernate.AbstractHibernateDataMigration;

/**
 * Migration for PhenoTips issue #362: Inconsistently named head_circumference property in the MeasurementsClass.
 * 
 * @version $Id$
 */
@Component
@Named("R45190Phenotips#362")
@Singleton
public class R45190PhenoTips362DataMigration extends AbstractHibernateDataMigration
{
    @Override
    public String getDescription()
    {
        return "Change head_circumference into hc in existing measurements after fixing PhenoTips issue #362";
    }

    @Override
    public XWikiDBVersion getVersion()
    {
        return new XWikiDBVersion(45190);
    }

    @Override
    public void hibernateMigrate() throws DataMigrationException, XWikiException
    {
        getStore().executeWrite(getXWikiContext(), new HibernateCallback<Object>()
        {
            @Override
            public Object doInHibernate(Session session) throws HibernateException, XWikiException
            {
                Query q =
                    session.createQuery("select hc from BaseObject o, FloatProperty hc"
                        + " where o.className = 'PhenoTips.MeasurementsClass'"
                        + " and hc.id.id = o.id and hc.id.name = 'head_circumference'");
                List<FloatProperty> properties = q.list();
                for (FloatProperty property : properties) {
                    FloatProperty updated = (FloatProperty) property.clone();
                    updated.setName("hc");
                    session.save(updated);
                    session.delete(property);
                }
                return null;
            }
        });
    }
}
